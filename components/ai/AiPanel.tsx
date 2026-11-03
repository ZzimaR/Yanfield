"use client";
import { copyText } from "@/lib/ui/clipboard";

/**
 * AI 助手面板（编辑器右栏 / 独立 AI 页面共用）
 *
 * 能力：
 * - 会话 Tab（最多 3 个）+ 历史会话 Sheet（新建/删除/打开）
 * - 3 个内置智能体（主编/写作/设定）+ 设置里的自定义智能体选择；旧内置 id 自动回落到主编
 * - 流式对话（/api/ai/chat）、reasoning 折叠、Markdown、消息复制/重试/删除
 * - @ 引用（章节/角色/世界观/伏笔/档案）、模式切换（对话/起草/技能）
 * - 上下文用量条 + 分节开关抽屉（/api/ai/context）
 * - 正文类 action 走逐块 diff 审阅或显式确认，经 EditorBridge 写入正文
 *
 * 独立渲染约定：只依赖 lib 层与 components/ui/kit，不 import components/editor。
 */
import * as React from "react";
import Link from "next/link";
import { Check, CircleAlert, Cpu, MessagesSquare, Plus, Settings2, X } from "lucide-react";
import { DiffReview } from "@/components/diff/DiffReview";
import { Button, IconButton, Sheet, Tooltip, useToast } from "@/components/ui/kit";
import { openSettingsDialog } from "@/components/settings/open";
import { apiGet, apiPatch, notifyDataChanged, streamAiAgent, useApi } from "@/lib/client/api";
import { ApiError } from "@/lib/client/api";
import { textToInsertHtml, useEditorBridge, type EditorBridge } from "@/lib/editor/bridge";
import { HAND_OFF_EVENT, takeHandOff, type HandOffDetail } from "@/lib/editor/hand-off";
import type {
  AgentId,
  AiAction,
  AppSettings,
  Chapter,
  ChatSession,
  ContextConfig,
  DashboardStats,
  PromptPreset,
  ProviderConfig,
} from "@/lib/types";
import { useMediaQuery } from "@/lib/ui/hooks";
import { cn, stripHtml, truncate } from "@/lib/ui/cn";
import { ActionReview } from "./ActionReview";
import { AgentPicker } from "./AgentPicker";
import { ChatComposer } from "./ChatComposer";
import { CodexProposal } from "./CodexProposal";
import { UsageIndicator, ContextStatus } from "./UsageIndicator";
import { ChatHistorySheet } from "./ChatHistorySheet";
import { ChatMessageView } from "./ChatMessageView";
import { ContextDrawer } from "./ContextDrawer";
import { useContextPreview } from "./ContextMeter";
import type { AgentRun } from "@/lib/ai/agent/types";
import { ModelPicker } from "./ModelPicker";
import { WelcomePanel } from "./WelcomePanel";
import { MAX_SESSION_TABS, useAiChat } from "./use-ai-chat";
import type { ChatExtras, MentionRef, PanelMode, PendingAction, UIMessage } from "./types";
import {
  ACTION_LABEL,
  AGENT_TINT_CLASS,
  actionToHtml,
  agentInitial,
  createContextConfig,
  extractActionText,
  isBodyAction,
  listAgents,
  resolveAgent,
} from "./utils";
import { describeModelTarget, withContextBudget } from "./model-info";
import { humanizeAiError } from "./errors";
import { SKILL_OPTIONS } from "./skills";
import { applyStyleToInstruction, readStyleFromInstruction } from "./styles";

export interface AiPanelProps {
  novelId: string;
  /** 当前章节；独立 AI 页面等无章节场景可省略 */
  chapterId?: string | null;
  chapterTitle?: string | null;
  defaultAgentId?: AgentId;
  /** 提供时显示关闭按钮；移动端自动全屏 */
  onClose?: () => void;
  className?: string;
}

interface DiffState {
  beforeHtml: string;
  afterHtml: string;
  action: AiAction;
}

export function AiPanel({
  novelId,
  chapterId,
  chapterTitle,
  defaultAgentId = "supervisor",
  onClose,
  className,
}: AiPanelProps) {
  const bridge = useEditorBridge();
  const { toast } = useToast();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const chat = useAiChat({ novelId, chapterId: chapterId ?? null, defaultAgentId });
  const { data: settings, setData: setSettingsData } = useApi<AppSettings>("/api/settings");
  const statsApi = useApi<DashboardStats>("/api/stats");
  const wasStreaming = React.useRef(false);
  const { data: providers } = useApi<{ items: ProviderConfig[] }>("/api/providers");
  const { data: presets } = useApi<{ items: PromptPreset[] }>(`/api/presets?novelId=${novelId}`);
  const agents = React.useMemo(() => listAgents(settings), [settings]);
  /** 只有一个智能体时隐藏选择器（内置已精简到 3 个，通常仍会显示） */
  const hasAgentChoice = agents.length > 1;
  const activeAgent = React.useMemo(
    () => resolveAgent(chat.activeTab.agentId, settings),
    [chat.activeTab.agentId, settings],
  );

  // 历史会话可能带着已精简掉的旧智能体 id：等设置加载完统一回落到主编，
  // 避免恢复会话后新建服务端会话时被白名单拒绝。
  const activeAgentId = chat.activeTab.agentId;
  React.useEffect(() => {
    if (settings === undefined) return;
    if (agents.some((agent) => agent.id === activeAgentId)) return;
    chat.setAgent("supervisor");
  }, [activeAgentId, agents, chat.setAgent, settings]);

  React.useEffect(() => {
    if (wasStreaming.current && !chat.streaming) void statsApi.refresh();
    wasStreaming.current = chat.streaming;
  }, [chat.streaming, statsApi.refresh]);

  // 上下文配置：设置加载完成后同步一次默认值，之后由用户开关控制
  const [contextConfig, setContextConfig] = React.useState<ContextConfig>(() => createContextConfig(null));
  const settingsSyncedRef = React.useRef(false);
  React.useEffect(() => {
    if (settings && !settingsSyncedRef.current) {
      settingsSyncedRef.current = true;
      setContextConfig(createContextConfig(settings));
    }
  }, [settings]);
  const preview = useContextPreview({ novelId, chapterId: chapterId ?? null, config: contextConfig });

  /** 预算：以 ContextConfig.contextBudget 为唯一来源（0=不限制），随请求传给服务端 */
  const budget = contextConfig.contextBudget;

  /** 保存预算到 settings.defaultContext（接口暂未支持时降级为仅本次会话生效） */
  const handleBudgetChange = React.useCallback(
    async (next: number) => {
      setContextConfig((prev) => withContextBudget(prev, next));
      try {
        const updated = await apiPatch<AppSettings>("/api/settings", {
          defaultContext: { contextBudget: next },
        });
        setSettingsData(updated);
        // 后端若尚未合并 contextBudget 会静默忽略：明确提示「仅本次会话生效」，避免误以为已保存
        if (Number(updated?.defaultContext?.contextBudget) !== next) {
          toast({
            title: "预算已在本会话生效",
            description: "默认预算暂未写入设置，刷新后会恢复原值。",
            tone: "default",
          });
        }
      } catch (error) {
        // 400 = 设置接口尚未识别 contextBudget：静默降级，预算仍然随本次请求生效
        if (error instanceof ApiError && error.status === 400) return;
        const info = humanizeAiError(error, {
          status: error instanceof ApiError ? error.status : undefined,
        });
        toast({ title: "默认预算保存失败", description: info.title, tone: "error" });
      }
    },
    [setSettingsData, toast],
  );

  /* ---------------- 文风偏好（写入 ContextConfig.customInstruction） ---------------- */

  const style = React.useMemo(
    () => readStyleFromInstruction(contextConfig.customInstruction),
    [contextConfig.customInstruction],
  );

  const handleStyleChange = React.useCallback(
    (next: string | null) => {
      setContextConfig((prev) => ({
        ...prev,
        customInstruction: applyStyleToInstruction(prev.customInstruction, next),
      }));
      toast({
        title: next ? `文风：${next}` : "已清除文风",
        description: next ? "会随之后每次对话请求一起发送给模型。" : "之后的对话不再携带文风偏好。",
        tone: "default",
      });
    },
    [toast],
  );

  // 每个会话 Tab 独立的草稿与引用
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [referenceSnapshots,setReferenceSnapshots]=React.useState<Record<string,HandOffDetail["snapshot"]>>({});
  const [mentionMap, setMentionMap] = React.useState<Record<string, MentionRef[]>>({});
  const [mode, setMode] = React.useState<PanelMode>("chat");
  const [focusSignal, setFocusSignal] = React.useState(0);
  const [task, setTask] = React.useState<{ id: string; label: string; snapshot?:HandOffDetail["snapshot"];selection?:string;targetChapterId?:string } | null>(null);
  const pendingAutoSendRef=React.useRef<string|null>(null);
  const sendingRef=React.useRef(false);
  const activeTabKeyRef=React.useRef(chat.activeKey);activeTabKeyRef.current=chat.activeKey;
  const codexAbortRef = React.useRef<AbortController | null>(null);
  const editAbortRef = React.useRef<AbortController | null>(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [contextOpen, setContextOpen] = React.useState(false);
  const [agentSheetOpen, setAgentSheetOpen] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const [diffState, setDiffState] = React.useState<DiffState | null>(null);

  const activeKey = chat.activeKey;
  const draft = drafts[activeKey] ?? "";
  const mentions = mentionMap[activeKey] ?? [];

  const setDraft = React.useCallback(
    (value: string) => setDrafts((prev) => ({ ...prev, [activeKey]: value })),
    [activeKey],
  );
  const setMentions = React.useCallback(
    (next: MentionRef[]) => setMentionMap((prev) => ({ ...prev, [activeKey]: next })),
    [activeKey],
  );

  /** 点击技能卡片：把示例指令填入当前草稿并聚焦输入框（由作者确认后发送） */
  const handlePickSkill = React.useCallback(
    (prompt: string) => {
      setDrafts((prev) => ({ ...prev, [activeKey]: prompt }));
      // 从「技能」mode 里选完技能后回到「对话」，避免输入框一直停在技能列表
      setMode("chat");
      setFocusSignal((value) => value + 1);
    },
    [activeKey],
  );

  /** 「编辑人设」：打开设置里的「智能体」分组。 */
  const handleOpenAgentSettings = React.useCallback(() => {
    setAgentSheetOpen(false);
    openSettingsDialog("agents");
  }, []);

  React.useEffect(() => {
    const apply = () => {
      const detail: HandOffDetail | null = takeHandOff();
      if (!detail) return;
      if(detail.referenceOnly) {
        setReferenceSnapshots(prev=>({...prev,[activeKey]:detail.snapshot}));
        setMentionMap(prev=>({...prev,[activeKey]:detail.reference?[...(prev[activeKey]??[]).filter(m=>m.type!==detail.reference!.type||m.id!==detail.reference!.id),detail.reference]:prev[activeKey]??[]}));
        setTask(detail.reference?null:{id:detail.taskId,label:detail.taskLabel,snapshot:detail.snapshot});
      } else {
        setDrafts(prev=>({...prev,[activeKey]:detail.prompt}));
        setMentionMap(prev=>({...prev,[activeKey]:detail.reference?[detail.reference]:[]}));
        setReferenceSnapshots(prev=>({...prev,[activeKey]:undefined}));
        setTask({id:detail.taskId,label:detail.taskLabel,snapshot:detail.snapshot,selection:detail.selection,targetChapterId:detail.reference?.type==="chapter"?detail.reference.id:undefined});
      }
      if(detail.autoSend)pendingAutoSendRef.current=detail.prompt;
      setFocusSignal((value) => value + 1);
    };
    apply();
    window.addEventListener(HAND_OFF_EVENT, apply);
    return () => window.removeEventListener(HAND_OFF_EVENT, apply);
  }, [activeKey]);
  React.useEffect(() => {
    const focusComposer = () => setFocusSignal((value) => value + 1);
    window.addEventListener("yantian:editor-focus-ai", focusComposer);
    return () => window.removeEventListener("yantian:editor-focus-ai", focusComposer);
  }, []);

  // 消息变化时贴底滚动
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [chat.activeTab.messages, activeKey]);

  /** 当前实际会用的 Provider / 模型（后端 resolveTarget 规则推导，用于顶栏展示与无模型引导） */
  const target = React.useMemo(
    () => describeModelTarget(settings, providers?.items, "chat"),
    [settings, providers],
  );
  const noProvider = Boolean(settings) && providers !== undefined && (!target || !target.ready);

  const buildExtras = React.useCallback((): ChatExtras => {
    const selection = bridge?.getSelectionText().trim();
    return {
      mentions,
      // 「技能」现在只是输入框里的技能选择器：发送时按普通对话处理
      mode: mode === "skill" ? "chat" : mode,
      context: contextConfig,
      selection: selection || undefined,
      presetId: null,
    };
  }, [bridge, contextConfig, mentions, mode]);

  /* ---------------- 发送 / 快捷提问 / 重试 ---------------- */

  const sendAgent = React.useCallback(async (text: string, retryMessage?: UIMessage) => {
    if (!text.trim() || chat.streaming || sendingRef.current) return;
    sendingRef.current=true;
    const originalKey=chat.activeKey;
    // Persist unsaved writing before the agent reads the chapter; a failed save leaves the input intact.
    try { await bridge?.flush?.(); } catch { sendingRef.current=false;return; }
    const historyMessages = retryMessage ? chat.activeTab.messages.slice(0, Math.max(0, chat.activeTab.messages.findIndex(m=>m.id===retryMessage.id)-1)) : chat.activeTab.messages;
    const history = historyMessages.filter(m=>m.status!=="streaming").slice(-10).map(m=>({role:m.role,content:m.content}));
    const previous = [...(retryMessage ? [retryMessage] : chat.activeTab.messages)].reverse().flatMap(m=>m.actions).find(a=>a.type==="agent-run");
    const previousRunId = previous && typeof previous.payload==="object" && previous.payload ? (previous.payload as {runId?:string}).runId : undefined;
    const selection=task?.selection||bridge?.getSelectionText().trim()||undefined;
    const references=[...mentions];
    const attached=referenceSnapshots[originalKey];
    const snapshot=task?.snapshot??(attached&&(!attached.id||references.some(m=>m.type===attached.kind&&m.id===attached.id))?attached:undefined);
    const sessionId=await chat.prepareSession();
    if(activeTabKeyRef.current!==originalKey){sendingRef.current=false;return;}
    const assistantId=chat.beginExchange(text, retryMessage?.id);
    const controller=new AbortController();
    editAbortRef.current=controller;
    setDraft("");setMentions([]);setTask(null);setReferenceSnapshots(prev=>({...prev,[originalKey]:undefined}));
    let currentRun:AgentRun|undefined;
    let action:AiAction|undefined;
    try {
      await streamAiAgent({novelId,chapterId:task?.targetChapterId||chapterId,sessionId:sessionId||undefined,agentId:chat.activeTab.agentId,message:text,snapshot,history,previousRunId,retryRunId:retryMessage ? previousRunId : undefined,selection,mentions:references,context:contextConfig}, {
        signal:controller.signal,
        onEvent:event=>{
          if(event.type==="meta") chat.patchExchange(assistantId,{provider:event.provider,model:event.model});
          if(event.type==="action") {action=event.action;chat.patchExchange(assistantId,{actions:[action]});}
          if(event.type==="agent") {
            currentRun=event.run;
            chat.patchExchange(assistantId,{agentRun:event.run,content:event.run.summary||"正在处理任务",status:event.run.status==="running"?"streaming":event.run.status==="error"?"error":event.run.status==="aborted"?"aborted":"complete",error:event.run.error,usage:event.run.usage});
          }
          if(event.type==="agent-preview" && currentRun) {
            currentRun={...currentRun,preview:currentRun.preview+event.text};
            chat.patchExchange(assistantId,{agentRun:currentRun});
          }
          if(event.type==="error") chat.patchExchange(assistantId,{status:"error",error:event.message,content:currentRun?.summary||"任务未完成"});
          if(event.type==="done") chat.patchExchange(assistantId,{usage:event.usage});
        },
      });
    } catch(e) {
      chat.patchExchange(assistantId,{status:controller.signal.aborted?"aborted":"error",content:currentRun?.summary||"任务未完成",error:controller.signal.aborted?"已停止，完成的候选已保留":e instanceof Error?e.message:"任务失败"});
      if(action) {
        const runId=(action.payload as {runId:string}).runId;
        try {const saved=await apiGet<AgentRun>(`/api/ai/agent/${runId}`);chat.patchExchange(assistantId,{agentRun:saved});}catch{}
      }
    } finally {sendingRef.current=false;editAbortRef.current=null;await chat.endExchange({persist:!sessionId});}
  },[bridge,chat,novelId,chapterId,mentions,contextConfig,task,referenceSnapshots,setDraft,setMentions]);
  React.useEffect(()=>{
    const text=pendingAutoSendRef.current;
    if(!text||chat.streaming)return;
    pendingAutoSendRef.current=null;
    void sendAgent(text);
  },[task,sendAgent,chat.streaming]);
  const handleSend=React.useCallback(()=>sendAgent(draft.trim()),[sendAgent,draft]);
  const handleQuickAsk=React.useCallback((prompt:string)=>{void sendAgent(prompt);},[sendAgent]);
  const handleRetry=React.useCallback((message:UIMessage)=>{
    const index=chat.activeTab.messages.findIndex(m=>m.id===message.id);
    const original=chat.activeTab.messages.slice(0,index).reverse().find(m=>m.role==="user");
    if(original)void sendAgent(original.content, message);
  },[chat.activeTab.messages,sendAgent]);

  const handleCopy = React.useCallback(
    async (message: UIMessage) => {
      try {
        await copyText([message.content, message.error].filter(Boolean).join("\n\n"));
        toast({ title: "已复制", tone: "success" });
      } catch {
        toast({ title: "复制失败", description: "请手动选中内容复制。", tone: "error" });
      }
    },
    [toast],
  );

  /* ---------------- 会话 ---------------- */

  const handleNewTab = React.useCallback(() => {
    if (!chat.newTab()) {
      toast({
        title: "最多同时打开 3 个会话",
        description: "请先关闭一个会话，再新建。",
        tone: "error",
      });
    }
  }, [chat, toast]);

  const handleOpenSession = React.useCallback(
    (session: ChatSession) => {
      void chat.openSession(session).then((result) => {
        if (!result.ok) {
          toast({
            title: "最多同时打开 3 个会话",
            description: "请先关闭一个会话，再打开历史会话。",
            tone: "error",
          });
          return;
        }
        if (result.loadFailed) {
          toast({ title: "历史消息加载失败", description: "已打开空会话，可继续对话。", tone: "error" });
        }
        setHistoryOpen(false);
      });
    },
    [chat, toast],
  );

  const handleCreateSession = React.useCallback(
    (session: ChatSession | null) => {
      setHistoryOpen(false);
      if (session) handleOpenSession(session);
      else handleNewTab();
    },
    [handleNewTab, handleOpenSession],
  );

  /* ---------------- 正文 action 应用 ---------------- */

  const handleAction = React.useCallback(
    (action: AiAction) => {
      if (!isBodyAction(action)) {
        toast({
          title: ACTION_LABEL[action.type] ?? action.label,
          description: "这是保存类操作，请到对应页面确认。",
          tone: "default",
        });
        return;
      }
      const payload = extractActionText(action);
      if (!payload.trim()) {
        toast({ title: "该操作没有可应用的正文内容", tone: "error" });
        return;
      }
      if (action.type === "replace-chapter") {
        setDiffState({
          beforeHtml: bridge?.getHtml() ?? "",
          afterHtml: actionToHtml(payload),
          action,
        });
      } else {
        setPendingAction({ action, text: payload });
      }
    },
    [bridge, toast],
  );

  const applyPendingAction = React.useCallback(() => {
    if (!pendingAction) return;
    if (!bridge) {
      toast({ title: "当前页面没有编辑器桥，无法应用", tone: "error" });
      return;
    }
    const { action, text } = pendingAction;
    if (action.type === "insert") {
      if (bridge.insertHtml) bridge.insertHtml(textToInsertHtml(text));
      else bridge.insertText(text);
    } else if (action.type === "append") {
      bridge.appendText(text);
    } else if (action.type === "replace-selection") {
      bridge.replaceSelection(text);
    }
    bridge.focus();
    notifyDataChanged();
    toast({ title: `已应用：${ACTION_LABEL[action.type] ?? action.label}`, tone: "success" });
    setPendingAction(null);
  }, [bridge, pendingAction, toast]);

  const applyDiff = React.useCallback(
    (html: string, acceptedIds: string[]) => {
      if (!bridge?.setHtml) {
        toast({ title: "当前编辑器不支持整章写回", description: "可先复制内容手动粘贴。", tone: "error" });
        return;
      }
      bridge.setHtml(html);
      bridge.focus();
      notifyDataChanged();
      toast({ title: `已应用 ${acceptedIds.length} 处改动`, tone: "success" });
      setDiffState(null);
    },
    [bridge, toast],
  );

  /* ---------------- 渲染 ---------------- */

  const rootClass = cn(
    "flex h-full min-h-0 w-full flex-col border-line bg-surface text-ink",
    !isMobile && "max-w-[440px] md:min-w-[340px] border-l",
    isMobile && onClose && "fixed inset-0 z-40 border-l-0",
    className,
  );

  return (
    <section className={cn(rootClass,"ai-surface")} aria-label="AI 助手面板">
      <header className="shrink-0 border-b border-line">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-accent/15 bg-accent/6 text-accent">
              <Cpu className="size-3.5" />
            </span>
            {/* 标题保持完整，仅章节名按剩余空间截断，避免 384px 窄面板下被徽标挤断 */}
            <span className="shrink-0 whitespace-nowrap font-serif text-[14px] text-ink">写作助手</span>
            {chapterTitle ? (
              <span className="min-w-0 flex-1 truncate text-[11px] text-ink-4 dark:text-ink-3">
                · {chapterTitle}
              </span>
            ) : null}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {noProvider ? (
              <Link
                href="/settings"
                onClick={(event) => {
                  event.preventDefault();
                  openSettingsDialog("providers");
                }}
                title="还没有可用的 AI 模型，去设置添加 Provider 或启用离线演示"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gold/30 bg-gold-soft px-2 py-0.5 text-[10.5px] text-gold transition-opacity duration-150 hover:opacity-80"
              >
                <CircleAlert className="size-3" />
                未配置模型
              </Link>
            ) : null}
            <Tooltip label="历史会话" side="bottom" align="end">
              <IconButton label="历史会话" onClick={() => setHistoryOpen(true)}>
                <MessagesSquare className="size-4" />
              </IconButton>
            </Tooltip>
            <Tooltip label="模型与 API Key 设置" side="bottom" align="end">
              <IconButton
                label="模型与 API Key 设置"
                onClick={() => openSettingsDialog("providers")}
              >
                <Settings2 className="size-4" />
              </IconButton>
            </Tooltip>
            {onClose ? (
              <IconButton label="关闭 AI 面板" onClick={onClose}>
                <X className="size-4" />
              </IconButton>
            ) : null}
          </div>
        </div>

        {/* 会话 Tab 条 */}
        {noProvider ? (
          <div className="flex items-start gap-1.5 border-t border-gold/20 bg-gold-soft/60 px-3 py-1.5 text-[11px] leading-relaxed text-gold dark:bg-gold-soft/40">
            <CircleAlert className="mt-0.5 size-3 shrink-0" />
            <span className="min-w-0 flex-1">
              还没有可用的 AI 模型，发送会失败；请到设置添加 Provider，或启用离线演示模式。
            </span>
            <Link
              href="/settings"
              onClick={(event) => {
                event.preventDefault();
                openSettingsDialog("providers");
              }}
              className="shrink-0 underline underline-offset-2 transition-opacity duration-150 hover:opacity-80"
            >
              去设置
            </Link>
          </div>
        ) : null}
        <div className="flex items-center gap-1 px-2 pb-1.5">
          <div className="scroll-hide flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {chat.tabs.map((tab) => {
              const active = tab.key === chat.activeKey;
              const label = tab.title.trim() || resolveAgent(tab.agentId, settings).name;
              return (
                <div
                  key={tab.key}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  onClick={() => chat.selectTab(tab.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      chat.selectTab(tab.key);
                    }
                  }}
                  className={cn(
                    "group/tab flex max-w-[148px] shrink-0 cursor-pointer items-center gap-1 rounded-sm border px-2 py-1 text-[12px] transition-colors duration-150",
                    active
                      ? "border-line bg-surface-2 text-ink"
                      : "border-transparent text-ink-3 hover:bg-surface-2 hover:text-ink-2",
                  )}
                >
                  <span className="min-w-0 truncate">{label}</span>
                  {chat.tabs.length > 1 ? (
                    <button
                      type="button"
                      aria-label="关闭会话"
                      onClick={(event) => {
                        event.stopPropagation();
                        chat.closeTab(tab.key);
                      }}
                      className="rounded-sm text-ink-4 opacity-0 transition-opacity duration-150 hover:text-danger group-hover/tab:opacity-100 dark:text-ink-3"
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </div>
              );
            })}
            <Tooltip label={chat.tabs.length >= MAX_SESSION_TABS ? "最多同时打开 3 个会话" : "新建会话"}>
              <IconButton
                label="新建会话"
                size="sm"
                onClick={handleNewTab}
                disabled={chat.tabs.length >= MAX_SESSION_TABS}
              >
                <Plus className="size-3.5" />
              </IconButton>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* 智能体选择：只有一个智能体时不显示，避免出现空下拉 */}
      {hasAgentChoice && chat.activeTab.messages.length === 0 ? (
        <div className="shrink-0 border-b border-line px-2.5 py-1.5">
          <AgentPicker
            value={chat.activeTab.agentId}
            onChange={chat.setAgent}
            agents={agents}
            className="w-full"
          />
        </div>
      ) : null}

      {/* 对话区 */}
      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {chat.activeTab.messages.length === 0 ? (
          <WelcomePanel
            agent={activeAgent}
            model={target}
            presets={presets?.items ?? null}
            onPickSkill={handlePickSkill}
            onSendExample={handleQuickAsk}
            disabled={chat.streaming}
          />
        ) : (
          <div className="mx-auto flex w-full max-w-[520px] flex-col gap-7">
            {chat.activeTab.messages.map((message, index) => (
              <div key={message.id} className="flex flex-col">
                <ChatMessageView
                  message={message}
                  agent={activeAgent}
                  streaming={chat.streaming && index === chat.activeTab.messages.length - 1}
                  canRetry={!chat.streaming}
                  onCopy={handleCopy}
                  onRetry={handleRetry}
                  onDelete={(target) => chat.removeMessage(target.id)}
                  onApplyAction={handleAction}
                  disableActions={chat.streaming}
                  onContinue={(text)=>{setDraft(text);setFocusSignal(v=>v+1);}}
                  pricing={settings?.aiPricing ?? statsApi.data?.aiPricing}
                />
                {message.codexItems && message.codexItems.length > 0 ? (
                  <CodexProposal
                    novelId={novelId}
                    items={message.codexItems}
                    applied={message.codexApplied === true}
                    superseded={message.codexSuperseded === true}
                    onChange={(items) => chat.patchExchange(message.id, { codexItems: items })}
                    onApplied={() => chat.patchExchange(message.id, { codexApplied: true })}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 上下文用量 + 输入区 */}
      <div className="shrink-0">
        <ChatComposer
          value={draft}
          onChange={setDraft}
          mode={mode}
          onModeChange={setMode}
          mentions={mentions}
          onMentionsChange={setMentions}
          onSend={() => void handleSend()}
          onStop={() => {
            codexAbortRef.current?.abort();
            editAbortRef.current?.abort();
            chat.stop();
          }}
          streaming={chat.streaming}
          novelId={novelId}
          chapterId={chapterId}
          placeholder={
            activeAgentId === "setting"
              ? "新建设定、修改角色或整理资料，生成后审阅改动…"
              : "输入要求，/ 选技能，@ 引用资料…"
          }
          onOpenContext={() => setContextOpen(true)}
          agentName={activeAgent.name}
          onOpenAgent={hasAgentChoice ? () => setAgentSheetOpen(true) : undefined}
          style={style}
          onStyleChange={handleStyleChange}
          skillOptions={SKILL_OPTIONS}
          task={task}
          onClearTask={() => setTask(null)}
          modelSlot={
            <ModelPicker
              settings={settings ?? null}
              providers={providers?.items}
              target={target}
              onChanged={setSettingsData}
              disabled={chat.streaming}
            />
          }
          focusSignal={focusSignal}
        />
        <div className="flex h-7 items-center gap-2 border-t border-line/60 px-3">
          {statsApi.data?<UsageIndicator label="今日" promptTokens={statsApi.data.todayPromptTokens} completionTokens={statsApi.data.todayCompletionTokens} calls={statsApi.data.todayAiCalls} price={statsApi.data.aiPricing??settings?.aiPricing??{inputPerMillion:0,outputPerMillion:0}}/>:<span className="text-[10px] text-ink-4">用量加载中</span>}
          <ContextStatus tokens={preview.data?.totalTokens??0} budget={budget} loading={preview.loading} error={preview.error} onClick={()=>setContextOpen(true)}/>
        </div>
      </div>

      {/* 智能体选择 Sheet（输入区「+ 智能体」chip 打开） */}
      <Sheet
        open={agentSheetOpen}
        onClose={() => setAgentSheetOpen(false)}
        title="选择智能体"
        width={380}
      >
        <div className="flex flex-col gap-1 px-3 py-3">
          {agents.map((agent) => {
            const active = agent.id === chat.activeTab.agentId;
            const tint = AGENT_TINT_CLASS[agent.tint];
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  chat.setAgent(agent.id);
                  setAgentSheetOpen(false);
                }}
                className={cn(
                  "flex items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors duration-150",
                  active
                    ? "border-accent/30 bg-accent-soft"
                    : "border-line bg-surface hover:bg-surface-2",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md font-serif text-[15px]",
                    tint.avatar,
                  )}
                  aria-hidden
                >
                  {agentInitial(agent)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] text-ink">{agent.name}</span>
                    {agent.id === "custom" ? (
                      <span className="shrink-0 rounded-full border border-line px-1 text-[9.5px] text-ink-4">
                        可配置
                      </span>
                    ) : null}
                    {active ? <Check className="ml-auto size-3.5 shrink-0 text-accent" /> : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-4">{agent.role}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[10.5px] leading-snug text-ink-4">
                    {agent.description}
                  </span>
                </span>
              </button>
            );
          })}
          <div className="mt-1 border-t border-line pt-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Settings2 className="size-3.5" />}
              onClick={handleOpenAgentSettings}
              className="w-full justify-start"
            >
              编辑人设
            </Button>
            <p className="mt-0.5 px-1 text-[10.5px] leading-snug text-ink-4">
              智能体的名字、职责、人设与额外要求都在「设置 · 智能体」里配置。
            </p>
          </div>
        </div>
      </Sheet>

      <ChatHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        novelId={novelId}
        activeSessionId={chat.activeTab.sessionId}
        defaultAgentId={chat.activeTab.agentId}
        maxTabsReached={chat.tabs.length >= MAX_SESSION_TABS}
        onOpenSession={handleOpenSession}
        onCreateSession={handleCreateSession}
      />

      <ContextDrawer
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        data={preview.data}
        loading={preview.loading}
        error={preview.error}
        onRefresh={preview.refresh}
        config={contextConfig}
        onConfigChange={setContextConfig}
        budget={budget}
        onBudgetChange={(next) => void handleBudgetChange(next)}
      />

      <ActionReview
        pending={pendingAction}
        onClose={() => setPendingAction(null)}
        onApply={applyPendingAction}
        canApply={Boolean(bridge)}
        applyDisabledHint="当前页面没有编辑器桥，无法写入正文；可先复制内容手动粘贴。"
      />

      <DiffReview
        open={diffState !== null}
        beforeHtml={diffState?.beforeHtml ?? ""}
        afterHtml={diffState?.afterHtml ?? ""}
        title={
          diffState
            ? `${ACTION_LABEL[diffState.action.type] ?? diffState.action.label} · 逐块审阅`
            : undefined
        }
        description="AI 修改了整章正文。请逐块确认要写入的内容，未勾选的块会保留当前正文。"
        canApply={Boolean(bridge?.setHtml)}
        applyDisabledHint="当前编辑器未暴露整章替换能力（bridge.setHtml），请改用插入/替换选区或手动复制。"
        onClose={() => setDiffState(null)}
        onApply={applyDiff}
      />
    </section>
  );
}

export default AiPanel;
