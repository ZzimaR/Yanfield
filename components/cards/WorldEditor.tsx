"use client";

/**
 * 世界观设定编辑 Sheet
 * 编辑：GET/PATCH /api/world/[id]；新建：POST /api/world；删除：DELETE /api/world/[id]
 * AI 补全：POST /api/ai/task（feature: world-card）
 */
import * as React from "react";
import { Sparkles, Trash2, GitBranch } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  Input,
  Select,
  Sheet,
  Switch,
  useToast,
} from "@/components/ui/kit";
import { AiTextField, TagsInput, stripChapterNumber, unwrapEntity, useErrorToast } from "@/components/outline/form-kit";
import { labeledDraft } from "@/lib/ai/assist-brief";
import { apiDelete, apiPatch, apiPost, notifyDataChanged, streamAiTask, useApi } from "@/lib/client/api";
import { parseCardFill } from "@/lib/ai/world-derive";
import { WorldDeriveSheet } from "./WorldDeriveSheet";
import type { AiStreamEvent, WorldCategory, WorldSetting } from "@/lib/types";
import { WORLD_CATEGORY_LABEL } from "@/lib/types";

interface WorldDraft {
  title: string;
  category: WorldCategory;
  parentId: string | null;
  summary: string;
  content: string;
  tags: string[];
  aiVisible: boolean;
  revealAtChapter: number | null;
  pinned: boolean;
}

function emptyDraft(parentId: string | null): WorldDraft {
  return {
    title: "",
    category: "rule",
    parentId,
    summary: "",
    content: "",
    tags: [],
    aiVisible: true,
    revealAtChapter: null,
    pinned: false,
  };
}

function toDraft(setting: WorldSetting): WorldDraft {
  return {
    title: setting.title,
    category: setting.category,
    parentId: setting.parentId,
    summary: setting.summary,
    content: setting.content,
    tags: [...setting.tags],
    aiVisible: setting.aiVisible,
    revealAtChapter: setting.revealAtChapter,
    pinned: setting.pinned,
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

export function WorldEditor({
  open,
  novelId,
  setting,
  settings,
  chapters,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  novelId: string;
  setting: WorldSetting | null;
  settings: WorldSetting[];
  chapters: { id: string; orderIndex: number; title: string }[];
  onClose: () => void;
  onSaved: (saved: WorldSetting) => void;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const editing = Boolean(setting);
  const detailApi = useApi<WorldSetting>(open && setting ? `/api/world/${setting.id}` : null);
  const [draft, setDraft] = React.useState<WorldDraft>(() => (setting ? toDraft(setting) : emptyDraft(null)));
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [deriveOpen, setDeriveOpen] = React.useState(false);
  const [filling, setFilling] = React.useState(false);
  const [savedId, setSavedId] = React.useState<string | null>(setting?.id ?? null);
  const nextDraftKey = open ? (setting?.id ?? "new") : "closed";
  const [draftKey, setDraftKey] = React.useState(nextDraftKey);
  if (draftKey !== nextDraftKey) {
    setDraftKey(nextDraftKey);
    if (open) {
      setSavedId(setting?.id ?? null);
      setDraft(setting ? toDraft(setting) : emptyDraft(null));
    }
  }
  const detailStamp = detailApi.data && setting && detailApi.data.id === setting.id ? detailApi.data.updatedAt : "";

  useErrorToast(detailApi.error, "设定详情加载失败");

  React.useEffect(() => {
    if (!open || !detailStamp || !setting || !detailApi.data || detailApi.data.id !== setting.id) return;
    setSavedId(setting.id);
    setDraft(toDraft(detailApi.data));
    // 详情回来后用服务端版本覆盖，避免列表里的摘要比正文旧
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailStamp]);

  const update = <K extends keyof WorldDraft>(key: K, value: WorldDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const title = draft.title.trim();
    if (!title) {
      toast({ title: "请先填写设定标题", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...draft, title };
      const saved = savedId
        ? await apiPatch<WorldSetting>(`/api/world/${savedId}`, payload)
        : await apiPost<WorldSetting>(`/api/world`, { novelId, ...payload });
      const entity = unwrapEntity(saved);
      setSavedId(entity.id);
      onSaved(entity);
      notifyDataChanged("world");
      toast({ title: editing ? "设定已保存" : "已新建设定", description: title, tone: "success" });
      onClose();
    } catch (err) {
      toast({ title: "保存设定失败", description: err instanceof Error ? err.message : String(err), tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!setting) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/world/${setting.id}`);
      setConfirmDeleteOpen(false);
      onDeleted();
      notifyDataChanged("world");
      toast({ title: "设定已删除", description: setting.title, tone: "success" });
      onClose();
    } catch (err) {
      toast({ title: "删除设定失败", description: err instanceof Error ? err.message : String(err), tone: "error" });
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
        feature: "world-card",
        message: ["这是补全当前卡片。", labeledDraft([
          { label: "标题", value: draft.title },
          { label: "摘要", value: draft.summary },
          { label: "正文", value: draft.content },
        ])].filter(Boolean).join("\n\n"),
        instruction:
          "这是补全当前卡片。只输出 JSON：{\"summary\":\"\",\"content\":\"\"}。只写这一条自己的事实，不要提问，不要把其他地点展开成完整条目。",
      },
      {
        onEvent: (event: AiStreamEvent) => {
          if (event.type === "delta") text += event.text;
        },
      },
    )
      .then(() => {
        const fill = parseCardFill(text);
        if (!fill) {
          toast({ title: "没有填进卡片", description: "生成结果不是这张卡的摘要和正文。", tone: "error" });
          return;
        }
        setDraft((prev) => ({
          ...prev,
          summary: fill.summary || prev.summary,
          content: fill.content || prev.content,
        }));
        toast({ title: "已填入当前卡片", description: "还没保存。确认后点保存才会写入。", tone: "success" });
      })
      .catch((err: unknown) => {
        toast({ title: "补全失败", description: err instanceof Error ? err.message : "请稍后再试", tone: "error" });
      })
      .finally(() => setFilling(false));
  };

  const ensureSource = async () => {
    if (savedId) return savedId;
    const title = draft.title.trim();
    if (!title) return null;
    const saved = unwrapEntity(await apiPost<WorldSetting>("/api/world", { novelId, ...draft, title }));
    setSavedId(saved.id);
    onSaved(saved);
    notifyDataChanged("world");
    return saved.id;
  };

  const parentOptions = [
    { value: "", label: "无（顶层设定）" },
    ...settings
      .filter((item) => item.id !== setting?.id)
      .map((item) => ({ value: item.id, label: item.title || "未命名设定" })),
  ];
  const parentTitle = settings.find((item) => item.id === draft.parentId)?.title;

  const chapterOptions = [
    { value: "", label: "立即揭示（一直可见）" },
    ...chapters.map((chapter) => ({
      value: String(chapter.orderIndex + 1),
      label: `第 ${chapter.orderIndex + 1} 章 · ${stripChapterNumber(chapter.title)}`,
    })),
  ];

  const displayTitle = draft.title.trim() || "未命名设定";
  const initial = displayTitle.slice(0, 1);
  const subtitle = [WORLD_CATEGORY_LABEL[draft.category], parentTitle ? `属于「${parentTitle}」` : "顶层设定"]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? "编辑设定" : "新建设定"}
      width={700}
      footer={
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
              {editing ? "保存" : "创建设定"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3.5 p-4 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-accent/60 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-accent/60">
        {/* 概览条：标题 / 分类与层级 + AI 补全入口 */}
        <div className="rounded-lg border border-line bg-surface-2 px-3.5 py-3">
          <div className="flex items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-jade-soft font-serif text-[16px] font-semibold text-jade"
              aria-hidden
            >
              {initial}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-ink">{displayTitle}</p>
              <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{subtitle}</p>
            </div>
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
            <Button variant="ghost" size="sm" icon={<GitBranch className="size-3.5" />} onClick={() => setDeriveOpen(true)}>
              衍生相关
            </Button>
          </div>
        </div>

        <p className="text-[11.5px] leading-relaxed text-ink-3">补全只改当前这张卡，不会自动保存。其他地点用「衍生相关」，勾选后才另存。</p>

        <EditorSection title="基本信息" hint="先给这条设定一个能搜到的名字与归属，AI 会按分类理解它的约束力。">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="标题"
              value={draft.title}
              placeholder="如：渡口、潮信"
              onChange={(event) => update("title", event.target.value)}
            />
            <Select
              label="分类"
              value={draft.category}
              onChange={(event) => update("category", event.target.value as WorldCategory)}
              options={Object.entries(WORLD_CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <Select
            label="父节点"
            value={draft.parentId ?? ""}
            onChange={(event) => update("parentId", event.target.value || null)}
            options={parentOptions}
            hint="用来表达设定之间的层级关系，子设定会跟随父设定一起被 AI 理解。"
          />
        </EditorSection>

        <EditorSection title="摘要" hint="一两句话说清核心，AI 在压缩上下文时会优先保留这一段。">
          <AiTextField
            label="摘要"
            field="设定摘要"
            feature="world-card"
            novelId={novelId}
            value={draft.summary}
            onChange={(value) => update("summary", value)}
            rows={2}
            placeholder="一两句话说清这条设定的核心。"
          />
        </EditorSection>

        <EditorSection title="正文" hint="规则、限制、代价、已发生的事件——越具体，AI 写得越稳。">
          <AiTextField
            label="正文"
            field="设定正文"
            feature="world-card"
            novelId={novelId}
            value={draft.content}
            onChange={(value) => update("content", value)}
            rows={8}
            placeholder="规则、限制、代价、已发生的事件…越具体，AI 写得越稳。"
          />
        </EditorSection>

        <EditorSection title="标签" hint="用于筛选与速查，不进入正文。">
          <TagsInput label="标签" value={draft.tags} onChange={(tags) => update("tags", tags)} placeholder="如：规则、势力、代价" />
        </EditorSection>

        <EditorSection title="AI 可见性" hint="控制 AI 什么时候能看到这条设定，避免提前剧透。">
          <Switch
            checked={draft.aiVisible}
            onChange={(checked) => update("aiVisible", checked)}
            label="对 AI 可见"
            hint="关闭后，AI 写作时看不到这条设定。"
          />
          <Select
            label="揭示时机"
            value={draft.revealAtChapter === null ? "" : String(draft.revealAtChapter)}
            onChange={(event) => update("revealAtChapter", event.target.value === "" ? null : Number(event.target.value))}
            options={chapterOptions}
            hint="到指定章之前，AI 不会看到这条设定。"
          />
          <Switch checked={draft.pinned} onChange={(checked) => update("pinned", checked)} label="置顶" hint="置顶设定排在列表最前。" />
        </EditorSection>

        {detailApi.loading ? <p className="text-[11px] text-ink-3">正在获取设定最新详情…</p> : null}
      </div>

      <WorldDeriveSheet
        open={deriveOpen}
        novelId={novelId}
        source={{
          id: savedId,
          title: draft.title,
          category: draft.category,
          summary: draft.summary,
          content: draft.content,
        }}
        onClose={() => setDeriveOpen(false)}
        onEnsureSource={ensureSource}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="删除这条设定？"
        description={`「${setting?.title ?? ""}」会被删除，其子设定不会自动迁移。此操作不可撤销。`}
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={() => void remove()}
        onClose={() => setConfirmDeleteOpen(false)}
      />
    </Sheet>
  );
}
