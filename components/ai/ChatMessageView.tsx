"use client";

/**
 * 单条聊天消息：
 * - 用户消息：右对齐气泡 + 悬停操作
 * - 助手消息：tint 色头像（智能体名首字）+ 模型名 + Markdown 正文
 *   + 可折叠「思考过程」+ 流式打字光标 + 正文类 action 审阅入口 + 操作工具条
 */
import * as React from "react";
import Link from "next/link";
import {
  Brain,
  ChevronDown,
  CircleAlert,
  Copy,
  Lightbulb,
  RotateCcw,
  Trash,
} from "lucide-react";
import type { AgentDef, AiAction, AiPricing } from "@/lib/types";
import { Badge, Button, IconButton, Markdown } from "@/components/ui/kit";
import { openSettingsDialog } from "@/components/settings/open";
import { cn, formatRelativeTime } from "@/lib/ui/cn";
import type { UIMessage } from "./types";
import { ACTION_LABEL, AGENT_TINT_CLASS, agentInitial, formatTokens, isBodyAction } from "./utils";
import { describeAiSpend } from "./AiSpendLine";

export interface ChatMessageViewProps {
  message: UIMessage;
  agent: AgentDef;
  /** 该消息是否正在接收流式内容（显示打字光标） */
  streaming?: boolean;
  /** 是否可重新生成（存在上一条用户消息才为 true） */
  canRetry?: boolean;
  onCopy?: (message: UIMessage) => void;
  onRetry?: (message: UIMessage) => void;
  onDelete?: (message: UIMessage) => void;
  /** 点击正文类 action 时回调（由面板决定弹 diff 审阅还是确认框） */
  onApplyAction?: (action: AiAction) => void;
  pricing?: AiPricing;
  className?: string;
}

export function ChatMessageView({
  message,
  agent,
  streaming = false,
  canRetry = false,
  onCopy,
  onRetry,
  onDelete,
  onApplyAction,
  pricing,
  className,
}: ChatMessageViewProps) {
  const [showReasoning, setShowReasoning] = React.useState(false);
  const tint = AGENT_TINT_CLASS[agent.tint] ?? AGENT_TINT_CLASS.accent;

  /* ---------------- 用户消息 ---------------- */
  if (message.role === "user") {
    return (
      <div className={cn("group/msg flex justify-end", className)}>
        <div className="flex max-w-[88%] flex-col items-end gap-1">
          <div className="whitespace-pre-wrap break-words rounded-lg rounded-br-sm bg-accent px-3 py-2 text-[13.5px] leading-[1.8] text-accent-ink dark:bg-accent-soft dark:text-ink">
            {message.content}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover/msg:opacity-100">
            <IconButton label="复制提问" size="sm" onClick={() => onCopy?.(message)}>
              <Copy className="size-3" />
            </IconButton>
            <IconButton label="删除这条提问" size="sm" onClick={() => onDelete?.(message)}>
              <Trash className="size-3" />
            </IconButton>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- 助手消息 ---------------- */
  const isStreaming = streaming || message.status === "streaming";
  const reasoningLength = (message.reasoning ?? "").trim().length;
  const usageLabel =
    message.usage && message.usage.totalTokens > 0
      ? describeAiSpend(message.usage.promptTokens, message.usage.completionTokens, pricing ?? { inputPerMillion: 0, outputPerMillion: 0 })
      : "";

  return (
    <div className={cn("group/msg flex gap-2", className)}>
      <span
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-sm font-serif text-[13px]",
          tint.avatar,
        )}
        aria-hidden
      >
        {agentInitial(agent)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[12px] font-medium text-ink-2">{agent.name}</span>
          {message.model ? (
            <span
              className="max-w-[180px] truncate text-[10.5px] text-ink-4 dark:text-ink-3"
              title={message.model}
            >
              {message.provider ? `${message.provider} / ` : ""}
              {message.model}
            </span>
          ) : null}
          {usageLabel ? (
            <span className="text-[10.5px] tabular-nums text-ink-4 dark:text-ink-3">{usageLabel}</span>
          ) : null}
          <span className="ml-auto shrink-0 text-[10.5px] text-ink-4 dark:text-ink-3">
            {formatRelativeTime(message.createdAt)}
          </span>
        </div>

        {reasoningLength > 0 ? (
          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => setShowReasoning((prev) => !prev)}
              aria-expanded={showReasoning}
              className="inline-flex items-center gap-1 rounded-sm text-[11px] text-ink-3 transition-colors duration-150 hover:text-ink-2 dark:text-ink-2 dark:hover:text-ink"
            >
              <Brain className="size-3" />
              {isStreaming ? "思考中…" : `思考过程 · ${formatTokens(reasoningLength)} 字`}
              <ChevronDown
                className={cn("size-3 transition-transform duration-150", showReasoning && "rotate-180")}
              />
            </button>
            {showReasoning ? (
              <div className="scroll-thin mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-line bg-surface-2 px-2.5 py-2 text-[12px] leading-relaxed text-ink-3 dark:text-ink-2">
                {message.reasoning}
              </div>
            ) : null}
          </div>
        ) : null}

        {message.content ? (
          <Markdown text={message.content} className={cn("mt-1", isStreaming && "ai-caret")} />
        ) : isStreaming ? (
          <div className="ai-caret mt-1 h-5" aria-label="正在生成" />
        ) : null}

        {!message.content && !isStreaming && message.status === "aborted" ? (
          <p className="mt-1 text-[12px] text-ink-4 dark:text-ink-3">已停止生成</p>
        ) : null}

        {message.status === "error" && (message.errorTitle || message.error) ? (
          <div className="mt-2 rounded-md border border-danger/25 bg-danger/10 px-2.5 py-2 text-[12px] leading-relaxed">
            <div className="flex items-start gap-2 text-danger">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 break-words font-medium">
                {message.errorTitle || message.error}
              </span>
              {canRetry ? (
                <button
                  type="button"
                  onClick={() => onRetry?.(message)}
                  className="shrink-0 underline decoration-danger/40 underline-offset-2 transition-colors hover:decoration-danger"
                >
                  重试
                </button>
              ) : null}
            </div>
            {message.errorHint ? (
              <p className="mt-1.5 pl-[22px] text-[11.5px] leading-relaxed text-ink-2 dark:text-ink-2">
                {message.errorHint}
              </p>
            ) : null}
            {message.errorAction === "settings-models" ? (
              <Link
                href="/settings"
                onClick={(event) => {
                  event.preventDefault();
                  openSettingsDialog("providers");
                }}
                className="ml-[22px] mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent transition-opacity duration-150 hover:opacity-80"
              >
                去「设置 → 模型服务」检查
                <span aria-hidden>→</span>
              </Link>
            ) : null}
          </div>
        ) : null}

        {message.actions.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {message.actions.map((action) =>
              isBodyAction(action) ? (
                <Button
                  key={action.id}
                  size="sm"
                  variant="secondary"
                  icon={<Lightbulb className="size-3" />}
                  onClick={() => onApplyAction?.(action)}
                >
                  {ACTION_LABEL[action.type] ?? action.label}
                  <span className="ml-1 text-[10.5px] text-ink-4 dark:text-ink-3">审阅</span>
                </Button>
              ) : (
                <Badge key={action.id} tone="jade">
                  {ACTION_LABEL[action.type] ?? action.label ?? "待保存"}
                </Badge>
              ),
            )}
          </div>
        ) : null}

        <div className="mt-1 flex items-center gap-0.5 opacity-60 transition-opacity duration-150 focus-within:opacity-100 group-hover/msg:opacity-100">
          <IconButton
            label="复制回复"
            size="sm"
            disabled={!message.content}
            onClick={() => onCopy?.(message)}
          >
            <Copy className="size-3.5" />
          </IconButton>
          {canRetry && !isStreaming ? (
            <IconButton label="重新生成" size="sm" onClick={() => onRetry?.(message)}>
              <RotateCcw className="size-3.5" />
            </IconButton>
          ) : null}
          <IconButton label="删除这条回复" size="sm" onClick={() => onDelete?.(message)}>
            <Trash className="size-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}