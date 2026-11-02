"use client";

/**
 * 伏笔编辑 Sheet
 * 编辑：GET/PATCH /api/foreshadows/[id]；新建：POST /api/foreshadows；删除：DELETE /api/foreshadows/[id]
 */
import * as React from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { Button, ConfirmDialog, Dropdown, Input, Select, Sheet, Textarea, useToast } from "@/components/ui/kit";
import { FloatWindow } from "@/components/editor/FloatWindow";
import { FORESHADOW_HANDOFF_TASKS, handToAssistant } from "@/lib/editor/hand-off";
import { ModelKeyHint } from "@/components/ai/ModelKeyHint";
import { apiDelete, apiPatch, apiPost, notifyDataChanged, streamAiTask, useApi } from "@/lib/client/api";
import { parseForeshadowFill } from "@/lib/ai/card-derive";
import { labeledDraft } from "@/lib/ai/assist-brief";
import type { AiStreamEvent, Foreshadow, ForeshadowStatus } from "@/lib/types";
import { FORESHADOW_STATUS_LABEL } from "@/lib/types";
import { stripChapterNumber, unwrapEntity, useErrorToast } from "@/components/outline/form-kit";

interface ForeshadowDraft {
  title: string;
  description: string;
  plantedChapterId: string | null;
  payoffChapterId: string | null;
  status: ForeshadowStatus;
  notes: string;
}

function emptyDraft(): ForeshadowDraft {
  return { title: "", description: "", plantedChapterId: null, payoffChapterId: null, status: "planted", notes: "" };
}

function toDraft(foreshadow: Foreshadow): ForeshadowDraft {
  return {
    title: foreshadow.title,
    description: foreshadow.description,
    plantedChapterId: foreshadow.plantedChapterId,
    payoffChapterId: foreshadow.payoffChapterId,
    status: foreshadow.status,
    notes: foreshadow.notes,
  };
}

/** 编辑区统一的分组卡片（与角色编辑保持一致） */
function EditorSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface-2/60 p-3.5">
      <div className="mb-3">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
        {hint ? <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{hint}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function ForeshadowEditor({
  open,
  novelId,
  foreshadow,
  chapters,
  onClose,
  onSaved,
  onDeleted,
  presentation = "sheet",
}: {
  open: boolean;
  novelId: string;
  foreshadow: Foreshadow | null;
  chapters: { id: string; orderIndex: number; title: string }[];
  onClose: () => void;
  onSaved: (saved: Foreshadow) => void;
  onDeleted: () => void;
  /** 写作台里用可拖动的窗口，不盖成整页。 */
  presentation?: "sheet" | "float";
}) {
  const { toast } = useToast();
  const editing = Boolean(foreshadow);
  const detailApi = useApi<Foreshadow>(open && foreshadow ? `/api/foreshadows/${foreshadow.id}` : null);
  const [draft, setDraft] = React.useState<ForeshadowDraft>(() => (foreshadow ? toDraft(foreshadow) : emptyDraft()));
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [filling, setFilling] = React.useState(false);
  const [savedId, setSavedId] = React.useState<string | null>(foreshadow?.id ?? null);
  const [minimized, setMinimized] = React.useState(false);
  const nextFloatKey = open ? (foreshadow?.id ?? "new") : "closed";
  const [floatKey, setFloatKey] = React.useState(nextFloatKey);
  if (floatKey !== nextFloatKey) {
    setFloatKey(nextFloatKey);
    if (open) setMinimized(false);
  }
  const initKey = `${open ? 1 : 0}:${foreshadow?.id ?? "new"}:${detailApi.data?.updatedAt ?? foreshadow?.updatedAt ?? ""}`;
  const lastInitKey = React.useRef("");

  useErrorToast(detailApi.error, "伏笔详情加载失败");

  const source = foreshadow ? detailApi.data && detailApi.data.id === foreshadow.id ? detailApi.data : foreshadow : null;

  React.useEffect(() => {
    if (lastInitKey.current === initKey) return;
    lastInitKey.current = initKey;
    if (!open) return;
    setSavedId(source?.id ?? null);
    setDraft(source ? toDraft(source) : emptyDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initKey, open]);

  const update = <K extends keyof ForeshadowDraft>(key: K, value: ForeshadowDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const chapterOptions = [
    { value: "", label: "未关联" },
    ...chapters.map((chapter) => ({
      value: chapter.id,
      label: `第 ${chapter.orderIndex + 1} 章 · ${stripChapterNumber(chapter.title)}`,
    })),
  ];

  const chapterTitle = (id: string | null) => {
    const chapter = chapters.find((item) => item.id === id);
    return chapter ? `第 ${chapter.orderIndex + 1} 章 · ${stripChapterNumber(chapter.title)}` : null;
  };

  const save = async () => {
    const title = draft.title.trim();
    if (!title) {
      toast({ title: "请先填写伏笔标题", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...draft, title };
      const saved = savedId
        ? await apiPatch<Foreshadow>(`/api/foreshadows/${savedId}`, payload)
        : await apiPost<Foreshadow>(`/api/foreshadows`, { novelId, ...payload });
      const entity = unwrapEntity(saved);
      setSavedId(entity.id);
      onSaved(entity);
      notifyDataChanged("foreshadows");
      toast({ title: editing ? "伏笔已保存" : "已新建伏笔", description: title, tone: "success" });
      onClose();
    } catch (err) {
      toast({ title: "保存伏笔失败", description: err instanceof Error ? err.message : String(err), tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!foreshadow) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/foreshadows/${foreshadow.id}`);
      setConfirmDeleteOpen(false);
      onDeleted();
      notifyDataChanged("foreshadows");
      toast({ title: "伏笔已删除", description: foreshadow.title, tone: "success" });
      onClose();
    } catch (err) {
      toast({ title: "删除伏笔失败", description: err instanceof Error ? err.message : String(err), tone: "error" });
    } finally {
      setDeleting(false);
    }
  };

  const fillCard = () => {
    setFilling(true);
    let text = "";
    void streamAiTask(
      {
        novelId,
        feature: "foreshadow-card",
        message: ["这是补全当前伏笔。", labeledDraft([
          { label: "标题", value: draft.title },
          { label: "说明", value: draft.description },
          { label: "备注", value: draft.notes },
        ])].filter(Boolean).join("\n\n"),
        instruction:
          "这是补全当前伏笔。只输出 JSON：{\"description\":\"\",\"notes\":\"\"}。只写这一条自己埋了什么、以后怎么收，不要提问，不要把别的线索写进来。",
      },
      {
        onEvent: (event: AiStreamEvent) => {
          if (event.type === "delta") text += event.text;
        },
      },
    )
      .then(() => {
        const fill = parseForeshadowFill(text);
        if (!fill) {
          toast({ title: "没有填进卡片", description: "生成结果不是这条伏笔的说明和备注。", tone: "error" });
          return;
        }
        setDraft((prev) => ({
          ...prev,
          description: fill.description || prev.description,
          notes: fill.notes || prev.notes,
        }));
        toast({ title: "已填入当前卡片", description: "还没保存。确认后点保存才会写入。", tone: "success" });
      })
      .catch((err: unknown) => {
        toast({ title: "补全失败", description: err instanceof Error ? err.message : "请稍后再试", tone: "error" });
      })
      .finally(() => setFilling(false));
  };

  const material = [
    draft.title.trim() ? `标题：${draft.title.trim()}` : "",
    draft.description.trim() ? `描述：${draft.description.trim()}` : "",
    draft.notes.trim() ? `备注：${draft.notes.trim()}` : "",
    `状态：${FORESHADOW_STATUS_LABEL[draft.status]}`,
  ]
    .filter(Boolean)
    .join("\n");

  const giveToAssistant = (task: (typeof FORESHADOW_HANDOFF_TASKS)[number]) => {
    const label = draft.title.trim() || "新伏笔";
    handToAssistant({
      reference: savedId ? { type: "foreshadow", id: savedId, label } : null,
      taskId: task.id,
      taskLabel: `${task.label} · ${label}`,
      prompt: material ? `${task.prompt}\n\n【当前材料】\n${material}` : task.prompt,
    });
    if (presentation === "float") setMinimized(true);
  };

  const displayTitle = draft.title.trim() || "未命名伏笔";
  const initial = displayTitle.slice(0, 1);
  const plantedTitle = chapterTitle(draft.plantedChapterId);
  const payoffTitle = chapterTitle(draft.payoffChapterId);
  const subtitle = [FORESHADOW_STATUS_LABEL[draft.status], plantedTitle ? `埋于${plantedTitle}` : "未关联埋设章"]
    .filter(Boolean)
    .join(" · ");

  const footer = (
    <div className="flex items-center gap-2 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-accent/60 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-accent/60">
      {editing ? (
        <Button variant="danger" size="sm" icon={<Trash2 className="size-3.5" />} onClick={() => setConfirmDeleteOpen(true)}>
          删除
        </Button>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button variant="primary" size="sm" loading={saving} onClick={save}>
          {savedId ? "保存" : "创建伏笔"}
        </Button>
      </div>
    </div>
  );

  const body = (
    <>
      <div className="space-y-3.5 p-4 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-accent/60 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-accent/60">
        {/* 概览条：标题 / 状态与埋设进度 */}
        <div className="rounded-lg border border-line bg-surface-2 px-3.5 py-3">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-soft font-serif text-[16px] font-semibold text-gold"
              aria-hidden
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-ink">{displayTitle}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{subtitle}</p>
            </div>
            {payoffTitle ? (
              <span className="shrink-0 rounded-full border border-line bg-surface px-2 py-0.5 text-[10.5px] text-ink-3">
                已安排回收
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-accent hover:bg-accent-soft"
              icon={<Sparkles className="size-3.5" />}
              loading={filling}
              onClick={fillCard}
            >
              补全这张卡
            </Button>
            {presentation === "float" ? (
              <Dropdown
                trigger={
                  <Button variant="ghost" size="sm">
                    交给助手
                  </Button>
                }
                items={FORESHADOW_HANDOFF_TASKS.map((task) => ({
                  label: task.label,
                  onSelect: () => giveToAssistant(task),
                }))}
              />
            ) : null}
          </div>
        </div>

        {presentation === "float" ? (
          <p className="text-[12px] leading-5 text-ink-3">交给助手会把这条伏笔和任务填进右侧输入框，你改完再发送。</p>
        ) : (
          <ol className="space-y-1.5 rounded-lg border border-line bg-surface px-3.5 py-3 text-[12px] leading-5 text-ink-2">
            <li>1. 先写标题。已有的说明可以留下，AI 会顺着你写过的事实补。</li>
            <li>2. 「补全这张卡」只改这一条的说明和备注，不会自动保存，也不会把别的线索写进来。看完点底部「{savedId ? "保存" : "创建伏笔"}」。</li>
            <li>3. 这段话里如果还有别的伏笔，在写作台把这条交给右侧助手。这里只改这一条。</li>
          </ol>
        )}
        <ModelKeyHint />

        <EditorSection title="基本信息" hint="一句话让读者记住它，状态决定统计里算不算「未收」。">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="标题"
              value={draft.title}
              placeholder="如：灯油里的铜钱"
              onChange={(event) => update("title", event.target.value)}
            />
            <Select
              label="状态"
              value={draft.status}
              onChange={(event) => update("status", event.target.value as ForeshadowStatus)}
              options={Object.entries(FORESHADOW_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
        </EditorSection>

        <EditorSection title="说明" hint="埋了什么、读者该记住什么、将来怎么回收。">
          <Textarea
            label=""
            rows={4}
            value={draft.description}
            placeholder="埋了什么、读者该记住什么、将来怎么回收。"
            onChange={(event) => update("description", event.target.value)}
            hint="写清「埋什么、怎么收」，AI 续写时才不会提前泄底。"
          />
        </EditorSection>

        <EditorSection title="章节" hint="标出埋设与回收的章节，故事档案与大纲会按这里对齐。">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="埋设章节"
              value={draft.plantedChapterId ?? ""}
              onChange={(event) => update("plantedChapterId", event.target.value || null)}
              options={chapterOptions}
            />
            <Select
              label="回收章节"
              value={draft.payoffChapterId ?? ""}
              onChange={(event) => update("payoffChapterId", event.target.value || null)}
              options={chapterOptions}
              hint={payoffTitle ? `计划回收：${payoffTitle}` : "还没想好可以留空。"}
            />
          </div>
        </EditorSection>

        <EditorSection title="备注" hint="只给自己看的写作提醒，不进入 AI 上下文。">
          <Textarea
            label=""
            rows={3}
            value={draft.notes}
            placeholder="写作提醒、注意事项（可选）。"
            onChange={(event) => update("notes", event.target.value)}
          />
        </EditorSection>

        {detailApi.loading ? <p className="text-[11px] text-ink-3">正在获取伏笔最新详情…</p> : null}
      </div>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="删除这条伏笔？"
        description={`「${foreshadow?.title ?? ""}」的登记会被删除。此操作不可撤销。`}
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </>
  );

  if (presentation === "float") {
    return (
      <FloatWindow
        open={open}
        title={editing ? "编辑伏笔" : "新伏笔"}
        minimized={minimized}
        onMinimizedChange={setMinimized}
        onClose={onClose}
        className={confirmDeleteOpen ? "z-40" : undefined}
        footer={footer}
      >
        {body}
      </FloatWindow>
    );
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "编辑伏笔" : "新建伏笔"} width={640} footer={footer}>
      {body}
    </Sheet>
  );
}
