"use client";

/**
 * AI 对话状态机（面板私有 hook）：
 * - 多会话 Tab（最多 3 个，各自维护消息与 sessionId）
 * - 首次发送时懒创建服务端会话（POST /api/chat/sessions），失败则整体降级为本地会话
 * - 流式订阅 /api/ai/chat（SSE），处理全部 AiStreamEvent 类型，支持 AbortController 停止
 * - done 后写库（POST /api/chat/sessions/[id]/messages）；失败后本次会话内不再尝试
 */
import * as React from "react";
import { apiGet, apiPost, streamAiChat } from "@/lib/client/api";
import { ApiError } from "@/lib/client/api";
import { uid } from "@/lib/ui/cn";
import type {
  AgentId,
  AiAction,
  AiChatRequest,
  AiStreamEvent,
  AiUsage,
  ChatMessage,
  ChatSession,
} from "@/lib/types";
import type { ChatExtras, ChatTab, SendChatInput, UIMessage } from "./types";
import {
  composeChatMessage,
  isAbortError,
  modeToRequestMode,
  toRequestMentions,
  toUiMessage,
} from "./utils";
import { humanizeAiError } from "./errors";

/** 最多同时打开的会话数 */
export const MAX_SESSION_TABS = 3;

export interface UseAiChatOptions {
  novelId: string;
  chapterId?: string | null;
  defaultAgentId: AgentId;
}

export type OpenSessionResult =
  | { ok: true; loadFailed?: boolean }
  | { ok: false; reason: "max-tabs" };

export interface UseAiChatResult {
  tabs: ChatTab[];
  activeKey: string;
  activeTab: ChatTab;
  streaming: boolean;
  streamingTabKey: string | null;
  /** 最近一次流式响应使用的模型（用于面板顶栏展示模型名） */
  modelLabel: string | null;
  send: (input: SendChatInput) => Promise<void>;
  stop: () => void;
  retry: (messageId: string, extras: ChatExtras) => Promise<void>;
  removeMessage: (messageId: string) => void;
  selectTab: (key: string) => void;
  newTab: () => boolean;
  closeTab: (key: string) => void;
  setAgent: (agentId: AgentId) => void;
  openSession: (session: ChatSession) => Promise<OpenSessionResult>;
}

function createMessage(role: UIMessage["role"], content = ""): UIMessage {
  return {
    id: uid("msg"),
    role,
    content,
    actions: [],
    status: "complete",
    provider: "",
    model: "",
    usage: null,
    error: "",
    createdAt: new Date().toISOString(),
  };
}

function createTab(agentId: AgentId): ChatTab {
  return {
    key: uid("tab"),
    sessionId: null,
    title: "",
    agentId,
    messages: [],
    createdAt: new Date().toISOString(),
  };
}

function pickMessages(data: unknown): UIMessage[] {
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
      ? ((data as { items: unknown[] }).items)
      : [];
  return list
    .filter((row): row is ChatMessage => !!row && typeof row === "object" && "role" in row)
    .map(toUiMessage);
}

export function useAiChat({ novelId, chapterId, defaultAgentId }: UseAiChatOptions): UseAiChatResult {
  const [tabs, setTabs] = React.useState<ChatTab[]>(() => [createTab(defaultAgentId)]);
  const [activeKey, setActiveKey] = React.useState<string>(() => tabs[0].key);
  const [streaming, setStreaming] = React.useState(false);
  const [streamingTabKey, setStreamingTabKey] = React.useState<string | null>(null);
  const [modelLabel, setModelLabel] = React.useState<string | null>(null);

  const stateRef = React.useRef({ tabs, activeKey });
  stateRef.current = { tabs, activeKey };
  const abortRef = React.useRef<AbortController | null>(null);
  const streamingRef = React.useRef(false);
  /** null=未知；true=可用；false=不可用（本页面内不再尝试） */
  const serverSessionRef = React.useRef<boolean | null>(null);

  const activeTab = tabs.find((tab) => tab.key === activeKey) ?? tabs[0];

  /* ---------------- 内部更新助手 ---------------- */

  const patchMessage = React.useCallback(
    (tabKey: string, messageId: string, updater: (message: UIMessage) => UIMessage) => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.key === tabKey
            ? {
                ...tab,
                messages: tab.messages.map((message) =>
                  message.id === messageId ? updater(message) : message,
                ),
              }
            : tab,
        ),
      );
    },
    [],
  );

  const appendMessages = React.useCallback((tabKey: string, messages: UIMessage[]) => {
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.key !== tabKey) return tab;
        const firstUser = messages.find((message) => message.role === "user");
        const title = tab.title || (firstUser ? firstUser.content.replace(/\s+/g, " ").slice(0, 16) : "");
        return { ...tab, title, messages: [...tab.messages, ...messages] };
      }),
    );
  }, []);

  /* ---------------- 流式请求核心 ---------------- */

  const runStream = React.useCallback(
    async (params: {
      tabKey: string;
      agentId: AgentId;
      sessionId: string | null;
      /** 实际发送给模型的文本（可能含起草模式前缀） */
      message: string;
      extras: ChatExtras;
    }) => {
      const { tabKey, agentId, message, extras } = params;
      const assistant = createMessage("assistant");
      assistant.status = "streaming";
      appendMessages(tabKey, [assistant]);

      streamingRef.current = true;
      setStreaming(true);
      setStreamingTabKey(tabKey);
      const controller = new AbortController();
      abortRef.current = controller;

      let sessionId = params.sessionId;
      let provider = "";
      let model = "";
      let content = "";
      let reasoning = "";
      const actions: AiAction[] = [];
      let usage: AiUsage | null = null;
      let serverMessageId: string | undefined;
      let failed = false;

      const snapshot = (patch?: Partial<UIMessage>) => {
        patchMessage(tabKey, assistant.id, (prev) => ({
          ...prev,
          content,
          reasoning: reasoning || undefined,
          actions: [...actions],
          provider: prev.provider || provider,
          model: prev.model || model,
          usage,
          ...patch,
        }));
      };

      const handleEvent = (event: AiStreamEvent) => {
        switch (event.type) {
          case "meta":
            provider = event.provider;
            model = event.model;
            setModelLabel(`${event.provider} / ${event.model}`);
            snapshot();
            break;
          case "delta":
            content += event.text;
            snapshot();
            break;
          case "reasoning":
            reasoning += event.text;
            snapshot();
            break;
          case "action":
            actions.push(event.action);
            snapshot();
            break;
          case "done":
            usage = event.usage ?? null;
            serverMessageId = event.messageId;
            snapshot();
            break;
          case "error": {
            failed = true;
            // 真实 Provider 错误 → 中文化、可操作提示（不静默失败）
            const info = humanizeAiError(event.message, { code: event.code });
            snapshot({
              status: "error",
              error: event.message,
              errorTitle: info.title,
              errorHint: info.hint,
              errorAction: info.action,
            });
            break;
          }
        }
      };

      // 1) 懒创建服务端会话（失败 → 纯本地会话）
      if (!sessionId && serverSessionRef.current !== false) {
        try {
          const created = await apiPost<ChatSession>("/api/chat/sessions", {
            novelId,
            chapterId: chapterId ?? null,
            agentId,
          });
          if (created?.id) {
            sessionId = created.id;
            serverSessionRef.current = true;
            setTabs((prev) =>
              prev.map((tab) => (tab.key === tabKey ? { ...tab, sessionId: created.id } : tab)),
            );
          }
        } catch {
          serverSessionRef.current = false;
        }
      }

      try {
        const request: AiChatRequest = {
          novelId,
          chapterId: chapterId ?? null,
          sessionId: sessionId ?? null,
          agentId,
          message,
          mode: modeToRequestMode(extras.mode),
          context: extras.context,
          selection: extras.selection?.trim() ? extras.selection : undefined,
          presetId: extras.presetId ?? null,
          mentions:
            extras.mentions.length > 0 ? toRequestMentions(extras.mentions) : undefined,
        };
        await streamAiChat(request, { onEvent: handleEvent, signal: controller.signal });
        if (!failed) {
          snapshot({ status: controller.signal.aborted ? "aborted" : "complete" });
        }
      } catch (error) {
        if (isAbortError(error)) snapshot({ status: "aborted" });
        else {
          const info = humanizeAiError(error, {
            status: error instanceof ApiError ? error.status : undefined,
          });
          snapshot({
            status: "error",
            error: error instanceof Error ? error.message : String(error),
            errorTitle: info.title,
            errorHint: info.hint,
            errorAction: info.action,
          });
        }
      } finally {
        streamingRef.current = false;
        abortRef.current = null;
        setStreaming(false);
        setStreamingTabKey(null);
      }

      // 2) 消息落库（接口不可用时降级为本地状态）
      if (!failed && sessionId && serverSessionRef.current !== false && !serverMessageId && content.trim()) {
        try {
          await Promise.all([
            apiPost(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
              role: "user",
              content: message,
            }),
            apiPost(`/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
              role: "assistant",
              content,
              reasoning,
              actions,
              status: "complete",
              provider,
              model,
              usage,
            }),
          ]);
          serverSessionRef.current = true;
        } catch {
          serverSessionRef.current = false;
        }
      }
    },
    [novelId, chapterId, appendMessages, patchMessage],
  );

  /* ---------------- 对外动作 ---------------- */

  const send = React.useCallback(
    async (input: SendChatInput) => {
      const text = input.text.trim();
      if (!text || streamingRef.current) return;
      const current =
        stateRef.current.tabs.find((tab) => tab.key === stateRef.current.activeKey) ??
        stateRef.current.tabs[0];
      if (!current) return;
      appendMessages(current.key, [createMessage("user", text)]);
      const extras: ChatExtras = {
        mentions: input.mentions,
        mode: input.mode,
        context: input.context,
        selection: input.selection,
        presetId: input.presetId,
      };
      await runStream({
        tabKey: current.key,
        agentId: current.agentId,
        sessionId: current.sessionId,
        message: composeChatMessage(text, input.mode),
        extras,
      });
    },
    [appendMessages, runStream],
  );

  const retry = React.useCallback(
    async (messageId: string, extras: ChatExtras) => {
      if (streamingRef.current) return;
      const current =
        stateRef.current.tabs.find((tab) => tab.key === stateRef.current.activeKey) ??
        stateRef.current.tabs[0];
      if (!current) return;
      const index = current.messages.findIndex((message) => message.id === messageId);
      if (index < 0) return;
      let userText = "";
      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        if (current.messages[cursor].role === "user") {
          userText = current.messages[cursor].content;
          break;
        }
      }
      if (!userText) return;
      // 丢弃该助手回复及其后的消息，保留此前的用户提问
      setTabs((prev) =>
        prev.map((tab) =>
          tab.key === current.key ? { ...tab, messages: tab.messages.slice(0, index) } : tab,
        ),
      );
      await runStream({
        tabKey: current.key,
        agentId: current.agentId,
        sessionId: current.sessionId,
        message: composeChatMessage(userText, extras.mode),
        extras,
      });
    },
    [runStream],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const removeMessage = React.useCallback((messageId: string) => {
    const key = stateRef.current.activeKey;
    setTabs((prev) =>
      prev.map((tab) =>
        tab.key === key
          ? { ...tab, messages: tab.messages.filter((message) => message.id !== messageId) }
          : tab,
      ),
    );
  }, []);

  const selectTab = React.useCallback((key: string) => setActiveKey(key), []);

  const newTab = React.useCallback((): boolean => {
    const current = stateRef.current.tabs;
    if (current.length >= MAX_SESSION_TABS) return false;
    const currentTab = current.find((tab) => tab.key === stateRef.current.activeKey) ?? current[0];
    const tab = createTab(currentTab?.agentId ?? defaultAgentId);
    setTabs((prev) => [...prev, tab]);
    setActiveKey(tab.key);
    return true;
  }, [defaultAgentId]);

  const closeTab = React.useCallback(
    (key: string) => {
      const current = stateRef.current;
      const target = current.tabs.find((tab) => tab.key === key);
      if (!target) return;
      if (streamingRef.current) abortRef.current?.abort();
      const remaining = current.tabs.filter((tab) => tab.key !== key);
      if (remaining.length === 0) {
        const replacement = createTab(defaultAgentId);
        setTabs([replacement]);
        setActiveKey(replacement.key);
        return;
      }
      setTabs(remaining);
      if (current.activeKey === key) {
        const index = current.tabs.findIndex((tab) => tab.key === key);
        const next = remaining[Math.min(index, remaining.length - 1)] ?? remaining[remaining.length - 1];
        setActiveKey(next.key);
      }
    },
    [defaultAgentId],
  );

  const setAgent = React.useCallback((agentId: AgentId) => {
    const key = stateRef.current.activeKey;
    setTabs((prev) => prev.map((tab) => (tab.key === key ? { ...tab, agentId } : tab)));
  }, []);

  const openSession = React.useCallback(
    async (session: ChatSession): Promise<OpenSessionResult> => {
      const current = stateRef.current;
      const existing = current.tabs.find((tab) => tab.sessionId === session.id);
      if (existing) {
        setActiveKey(existing.key);
        return { ok: true };
      }
      if (current.tabs.length >= MAX_SESSION_TABS) return { ok: false, reason: "max-tabs" };

      let messages: UIMessage[] = [];
      let loadFailed = false;
      try {
        const data = await apiGet<unknown>(
          `/api/chat/sessions/${encodeURIComponent(session.id)}/messages`,
        );
        messages = pickMessages(data);
      } catch {
        loadFailed = true;
        serverSessionRef.current = false;
      }

      const tab: ChatTab = {
        key: uid("tab"),
        sessionId: session.id,
        title: session.title?.trim() || "",
        agentId: session.agentId,
        messages,
        createdAt: session.createdAt,
      };
      setTabs((prev) => [...prev, tab]);
      setActiveKey(tab.key);
      return { ok: true, loadFailed };
    },
    [],
  );

  return {
    tabs,
    activeKey,
    activeTab,
    streaming,
    streamingTabKey,
    modelLabel,
    send,
    stop,
    retry,
    removeMessage,
    selectTab,
    newTab,
    closeTab,
    setAgent,
    openSession,
  };
}
