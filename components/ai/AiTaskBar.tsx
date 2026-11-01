"use client";

/**
 * AI 快捷任务条：续写 / 扩写 / 润色 / 去 AI 味 / 诊断 / 剧情推演 / 章纲。
 * 点击任务即调用 /api/ai/task 流式生成，在 Sheet 内实时预览；
 * 完成后可插入正文 / 替换选区 / 复制 / 丢弃，正文类 action 走 diff 审阅。
 */
import * as React from "react";
import Link from "next/link";
import {
  Check,
  CircleAlert,
  Compass,
  Copy,
  Eraser,
  Gauge,
  Layers,
  ListTree,
  LoaderCircle,
  PenLine,
  Sparkles,
  Trash,
} from "lucide-react";
import { Badge, Button, IconButton, Sheet, Tooltip, useToast } from "@/components/ui/kit";
import { openSettingsDialog } from "@/components/settings/open";
import { DiffReview } from "@/components/diff/DiffReview";
import { notifyDataChanged, streamAiTask } from "@/lib/client/api";
import { ApiError } from "@/lib/client/api";
import { textToInsertHtml, useEditorBridge } from "@/lib/editor/bridge";
import { AI_FEATURE_LABEL, type AiAction, type AiFeature, type AiUsage, type ContextConfig } from "@/lib/types";
import { cn, stripHtml, truncate } from "@/lib/ui/cn";
import { ACTION_LABEL, actionToHtml, extractActionText, isAbortError, isBodyAction } from "./utils";
import { describeAiSpend } from "./AiSpendLine";
import { humanizeAiError, type AiErrorInfo } from "./errors";

interface TaskDef {
  key: string;
  feature: AiFeature;
  label: string;
  hint: string;
  icon: React.ReactNode;
  /** 需要选中正文才能执行 */
  needsSelection?: boolean;
  targetWords?: number;
  instruction?: string;
}

const TASKS: TaskDef[] = [
  {
    key: "continue",
    feature: "continue",
    label: "续写",
    hint: "基于最近正文承接续写约 600 字",
    icon: <PenLine className="size-3.5" />,
    targetWords: 600,
  },
  {
    key: "expand",
    feature: "expand",
    label: "扩写",
    hint: "把选中的段落扩写得更丰满（需选中正文）",
    icon: <Layers className="size-3.5" />,
    needsSelection: true,
    targetWords: 800,
  },
  {
    key: "polish",
    feature: "polish",
    label: "润色",
    hint: "润色选中段落，保持原意与人物口吻（需选中正文）",
    icon: <Sparkles className="size-3.5" />,
    needsSelection: true,
  },
  {
    key: "deai",
    feature: "deai",
    label: "去 AI 味",
    hint: "改写选中段落，去除 AI 腔调与套话（需选中正文）",
    icon: <Eraser className="size-3.5" />,
    needsSelection: true,
  },
  {
    key: "diagnose",
    feature: "diagnose",
    label: "诊断",
    hint: "体检当前章节：节奏、冲突、人物一致性与伏笔",
    icon: <Gauge className="size-3.5" />,
  },
  {
    key: "plot",
    feature: "custom",
    label: "剧情推演",
    hint: "推演接下来 3–5 章的剧情走向",
    icon: <Compass className="size-3.5" />,
    instruction:
      "请基于本书总纲、当前卷纲、本章章纲、人物档案与最近正文，推演接下来 3–5 章的剧情走向。要求：每章给出核心冲突、关键转折、伏笔回收/埋设与情绪曲线；只输出规划，不要写正文散文。",
  },
  {
    key: "outline",
    feature: "outline-chapter",
    label: "章纲",
    hint: "为当前章节生成或补全章纲",
    icon: <ListTree className="size-3.5" />,
  },
];

type TaskStatus = "idle" | "streaming" | "done" | "error" | "aborted";

export interface AiTaskBarProps {
  novelId: string;
  chapterId?: string | null;
  /** 外部指定选中正文；缺省从编辑器 bridge 现取 */
  selection?: string;
  /** 精简模式：只显示图标按钮 + Tooltip */
  compact?: boolean;
  /** 上下文配置（一般传 settings.defaultContext） */
  context?: Partial<ContextConfig>;
  className?: string;
}

export function AiTaskBar({
  novelId,
  chapterId,
  selection,
  compact = false,
  context,
  className,
}: AiTaskBarProps) {
  const bridge = useEditorBridge();
  const { toast } = useToast();

  const [activeTask, setActiveTask] = React.useState<TaskDef | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [reasoning, setReasoning] = React.useState("");
  const [model, setModel] = React.useState("");
  const [usage, setUsage] = React.useState<AiUsage | null>(null);
  const [status, setStatus] = React.useState<TaskStatus>("idle");
  const [errorInfo, setErrorInfo] = React.useState<AiErrorInfo | null>(null);
  const [actions, setActions] = React.useState<AiAction[]>([]);
  const [replacement, setReplacement] = React.useState<{
    beforeHtml: string;
    afterHtml: string;
    action: AiAction;
  } | null>(null);

  const abortRef = React.useRef<AbortController | null>(null);
  const running = status === "streaming";

  const readSelection = React.useCallback(
    () => (selection ?? bridge?.getSelectionText() ?? "").trim(),
    [bridge, selection],
  );

  const runTask = React.useCallback(
    async (task: TaskDef) => {
      if (abortRef.current) return;
      const currentSelection = readSelection();
      if (task.needsSelection && !currentSelection) {
        toast({ title: "请先在正文中选中要处理的段落", tone: "error" });
        return;
      }
      setActiveTask(task);
      setPreviewOpen(true);
      setText("");
      setReasoning("");
      setModel("");
      setUsage(null);
      setErrorInfo(null);
      setActions([]);
      setStatus("streaming");

      const controller = new AbortController();
      abortRef.current = controller;
      let acc = "";
      let think = "";
      let failed = false;

      try {
        await streamAiTask(
          {
            novelId,
            chapterId: chapterId ?? null,
            feature: task.feature,
            selection: currentSelection || undefined,
            context,
            presetId: null,
            targetWords: task.targetWords,
            instruction: task.instruction,
          },
          {
            signal: controller.signal,
            onEvent: (event) => {
              switch (event.type) {
                case "meta":
                  setModel(`${event.provider} / ${event.model}`);
                  break;
                case "delta":
                  acc += event.text;
                  setText(acc);
                  break;
                case "reasoning":
                  think += event.text;
                  setReasoning(think);
                  break;
                case "action":
                  setActions((prev) => [...prev, event.action]);
                  break;
                case "done":
                  setUsage(event.usage ?? null);
                  break;
                case "error":
                  failed = true;
                  setStatus("error");
                  setErrorInfo(humanizeAiError(event.message, { code: event.code }));
                  break;
              }
            },
          },
        );
        if (!failed) setStatus(controller.signal.aborted ? "aborted" : "done");
      } catch (err) {
        if (isAbortError(err)) setStatus("aborted");
        else {
          setStatus("error");
          setErrorInfo(
            humanizeAiError(err, { status: err instanceof ApiError ? err.status : undefined }),
          );
        }
      } finally {
        abortRef.current = null;
      }
    },
    [chapterId, context, novelId, readSelection, toast],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const copyText = React.useCallback(async () => {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "已复制到剪贴板", tone: "success" });
    } catch {
      toast({ title: "复制失败", description: "请手动选中预览内容复制。", tone: "error" });
    }
  }, [text, toast]);

  const discard = React.useCallback(() => {
    if (running) stop();
    setPreviewOpen(false);
  }, [running, stop]);

  /** 写入正文：insert=光标处插入，replace=替换当前选中 */
  const writeToBody = React.useCallback(
    (mode: "insert" | "replace") => {
      const content = text.trim();
      if (!content) return;
      if (!bridge) {
        toast({
          title: "当前页面没有可写入的编辑器",
          description: "可以先用「复制」把结果带回正文。",
          tone: "error",
        });
        return;
      }
      if (mode === "insert") {
        if (bridge.insertHtml) bridge.insertHtml(textToInsertHtml(content));
        else bridge.insertText(content);
        bridge.focus();
        notifyDataChanged();
        toast({ title: "已插入正文", tone: "success" });
        setPreviewOpen(false);
        return;
      }
      if (!readSelection()) {
        if (bridge.insertHtml) bridge.insertHtml(textToInsertHtml(content));
        else bridge.insertText(content);
        bridge.focus();
        notifyDataChanged();
        toast({ title: "未检测到选中文本，已插入光标处", tone: "success" });
        setPreviewOpen(false);
        return;
      }
      bridge.replaceSelection(content);
      bridge.focus();
      notifyDataChanged();
      toast({ title: "已替换选中正文", tone: "success" });
      setPreviewOpen(false);
    },
    [bridge, readSelection, text, toast],
  );

  const openReview = React.useCallback(
    (action: AiAction) => {
      if (!bridge) {
        toast({ title: "当前页面没有编辑器，无法审阅并写入正文", tone: "error" });
        return;
      }
      const payload = extractActionText(action);
      if (!payload) {
        toast({ title: "该操作没有可审阅的正文内容", tone: "default" });
        return;
      }
      const beforeHtml = bridge.getHtml();
      const patchHtml = actionToHtml(payload);
      // append/insert 是「在原文基础上追加」，审阅时需要把原文一起放进去对比；
      // 否则 diff 会把追加段落和原文段落错位合并成大量「修改/删除」。
      const afterHtml =
        action.type === "append" || action.type === "insert" ? `${beforeHtml}${patchHtml}` : patchHtml;
      setReplacement({ beforeHtml, afterHtml, action });
    },
    [bridge, toast],
  );

  const footer = (
    <div className="flex w-full flex-wrap items-center gap-1.5">
      <span className="mr-auto min-w-0 truncate text-[11px] text-ink-4">
        {model || (running ? "正在连接模型…" : "—")}
        {usage ? ` · ${describeAiSpend(usage.promptTokens, usage.completionTokens, { inputPerMillion: 0, outputPerMillion: 0 })}` : ""}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void copyText()}
        disabled={!text.trim()}
        icon={<Copy className="size-3.5" />}
      >
        复制
      </Button>
      <Button variant="ghost" size="sm" onClick={discard} icon={<Trash className="size-3.5" />}>
        {running ? "停止并丢弃" : "丢弃"}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => writeToBody("replace")}
        disabled={status !== "done" || !text.trim() || !bridge}
        title={bridge ? "替换正文中选中的段落" : "当前页面没有编辑器"}
      >
        替换选区
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={() => writeToBody("insert")}
        disabled={status !== "done" || !text.trim() || !bridge}
        title={bridge ? "插入到光标处" : "当前页面没有编辑器"}
        icon={<Check className="size-3.5" />}
      >
        插入正文
      </Button>
    </div>
  );

  return (
    <div className={cn("flex min-w-0 items-center gap-1 overflow-x-auto scroll-hide", className)}>
      {TASKS.map((task) =>
        compact ? (
          <Tooltip key={task.key} label={`${task.label} · ${task.hint}`} side="bottom">
            <IconButton label={task.label} onClick={() => void runTask(task)} disabled={running}>
              {task.icon}
            </IconButton>
          </Tooltip>
        ) : (
          <Button
            key={task.key}
            variant="ghost"
            size="sm"
            icon={task.icon}
            title={task.hint}
            onClick={() => void runTask(task)}
            disabled={running}
          >
            {task.label}
          </Button>
        ),
      )}
      {running ? (
        <span className="ml-1 inline-flex shrink-0 items-center gap-1 text-[11px] text-ink-3">
          <LoaderCircle className="size-3.5 animate-spin" />
          生成中…
        </span>
      ) : null}

      <Sheet
        open={previewOpen}
        onClose={() => {
          if (running) stop();
          setPreviewOpen(false);
        }}
        title={activeTask ? `${AI_FEATURE_LABEL[activeTask.feature] ?? activeTask.label}` : "AI 任务"}
        width={560}
        footer={footer}
      >
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={status === "error" ? "danger" : running ? "accent" : "jade"}>
              {activeTask?.label ?? "AI 任务"}
            </Badge>
            <span className="text-[11px] text-ink-4 dark:text-ink-3">
              {running ? "生成中，可随时停止" : status === "done" ? "已完成" : status === "aborted" ? "已停止" : "生成失败"}
            </span>
            <span className="ml-auto text-[11px] text-ink-4 dark:text-ink-3">{model}</span>
          </div>

          {errorInfo ? (
            <div className="rounded-md border border-danger/25 bg-danger/10 px-2.5 py-2 text-[12px] leading-relaxed">
              <div className="flex items-start gap-2 text-danger">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 break-words font-medium">{errorInfo.title}</span>
              </div>
              <p className="mt-1.5 pl-[22px] text-[11.5px] leading-relaxed text-ink-2 dark:text-ink-2">
                {errorInfo.hint}
              </p>
              {errorInfo.action === "settings-models" ? (
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

          {reasoning ? (
            <details className="rounded-md border border-line bg-surface-2 px-2.5 py-2">
              <summary className="cursor-pointer text-[11.5px] text-ink-3 dark:text-ink-2">
                思考过程 · {reasoning.length} 字
              </summary>
              <div className="scroll-thin mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-[12px] leading-relaxed text-ink-3 dark:text-ink-2">
                {reasoning}
              </div>
            </details>
          ) : null}

          <div
            className={cn(
              "min-h-[180px] whitespace-pre-wrap break-words rounded-md border border-line bg-paper px-3 py-2.5 font-serif text-[14px] leading-[1.95] text-ink-2",
              running && "ai-caret",
            )}
          >
            {text || (running ? "" : "（无输出）")}
          </div>

          {actions.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-ink-4">AI 建议的正文操作</span>
              {actions.map((action) =>
                isBodyAction(action) ? (
                  <div
                    key={action.id}
                    className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5"
                  >
                    <Badge tone="jade">{ACTION_LABEL[action.type] ?? action.label}</Badge>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-3">
                      {truncate(stripHtml(extractActionText(action) || action.label), 60)}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => openReview(action)}>
                      逐块审阅
                    </Button>
                  </div>
                ) : (
                  <div
                    key={action.id}
                    className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5"
                  >
                    <Badge tone="gold">{ACTION_LABEL[action.type] ?? action.label}</Badge>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-3">
                      保存类操作，请在对应页面确认
                    </span>
                  </div>
                ),
              )}
            </div>
          ) : null}
        </div>
      </Sheet>

      <DiffReview
        open={replacement !== null}
        beforeHtml={replacement?.beforeHtml ?? ""}
        afterHtml={replacement?.afterHtml ?? ""}
        title={
          replacement
            ? `${ACTION_LABEL[replacement.action.type] ?? replacement.action.label} · 逐块审阅`
            : "逐块审阅"
        }
        canApply={Boolean(bridge?.setHtml)}
        applyDisabledHint="当前编辑器未暴露整章替换能力，请改用插入/替换选区，或手动复制"
        onClose={() => setReplacement(null)}
        onApply={(html, acceptedIds) => {
          if (!bridge?.setHtml) return;
          bridge.setHtml(html);
          bridge.focus();
          notifyDataChanged();
          toast({ title: `已应用 ${acceptedIds.length} 处改动`, tone: "success" });
          setReplacement(null);
          setPreviewOpen(false);
        }}
      />
    </div>
  );
}