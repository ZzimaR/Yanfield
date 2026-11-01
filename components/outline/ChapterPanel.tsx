"use client";

/**
 * 章纲列：章节列表（按当前卷过滤）+ 选中章的章纲编辑器
 * GET /api/chapters?novelId= / GET+PATCH /api/chapters/[id]/blueprint
 */
import * as React from "react";
import { FileText, PenLine, Plus } from "lucide-react";
import { Badge, Button, Dialog, EmptyState, Input, Select, useToast } from "@/components/ui/kit";
import { apiPost, notifyDataChanged } from "@/lib/client/api";
import type { Chapter, Foreshadow, Volume } from "@/lib/types";
import { cn, formatWords } from "@/lib/ui/cn";
import { BlueprintEditor } from "./BlueprintEditor";
import { PanelCard, PanelSkeleton, stripChapterNumber, unwrapEntity } from "./form-kit";

const STATUS_DOT: Record<Chapter["status"], string> = {
  draft: "bg-ink-4",
  revising: "bg-gold",
  done: "bg-jade",
};

const STATUS_LABEL: Record<Chapter["status"], string> = {
  draft: "草稿",
  revising: "修改中",
  done: "已完成",
};

export interface ChapterPanelProps {
  novelId: string;
  chapters: Chapter[];
  volumes: Volume[];
  activeVolumeId: string | null;
  selectedChapterId: string | null;
  onSelectChapter: (chapterId: string) => void;
  foreshadows: Foreshadow[];
  /** 已有章纲的章节 id */
  blueprintFilled: Set<string>;
  /** 新建章节 / 保存章纲后刷新列表 */
  onChaptersChanged: () => void;
  onBlueprintSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  loading?: boolean;
}

export function ChapterPanel({
  novelId,
  chapters,
  volumes,
  activeVolumeId,
  selectedChapterId,
  onSelectChapter,
  foreshadows,
  blueprintFilled,
  onChaptersChanged,
  onBlueprintSaved,
  onDirtyChange,
  loading = false,
}: ChapterPanelProps) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState("");
  const [newVolumeId, setNewVolumeId] = React.useState<string>("");
  const [creating, setCreating] = React.useState(false);
  const activeRowRef = React.useRef<HTMLButtonElement | null>(null);

  const scopeChapters = activeVolumeId ? chapters.filter((chapter) => chapter.volumeId === activeVolumeId) : chapters;
  const selectedChapter = chapters.find((chapter) => chapter.id === selectedChapterId) ?? null;
  const scopeTitle = activeVolumeId ? volumes.find((volume) => volume.id === activeVolumeId)?.title ?? "本卷" : "全部章节";

  React.useEffect(() => {
    if (activeRowRef.current) activeRowRef.current.scrollIntoView({ block: "nearest" });
  }, [selectedChapterId]);

  const openCreate = () => {
    setNewTitle(`第 ${chapters.length + 1} 章`);
    setNewVolumeId(activeVolumeId ?? volumes[0]?.id ?? "");
    setCreateOpen(true);
  };

  const createChapter = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const created = unwrapEntity(
        await apiPost<Chapter>(`/api/chapters`, {
          novelId,
          volumeId: newVolumeId || null,
          title,
        }),
      );
      setCreateOpen(false);
      onChaptersChanged();
      notifyDataChanged("chapters");
      onSelectChapter(created.id);
      toast({ title: "已新建章节", description: title, tone: "success" });
    } catch (err) {
      toast({ title: "新建章节失败", description: err instanceof Error ? err.message : String(err), tone: "error" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <PanelCard
      title="章纲"
      icon={<FileText className="size-4" />}
      description={`${scopeTitle} · ${scopeChapters.length} 章`}
      actions={
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px]" icon={<Plus className="size-3.5" />} onClick={openCreate}>
          新建章
        </Button>
      }
      bodyClassName="space-y-3.5"
    >
      {scopeChapters.length === 0 ? (
        loading ? (
          <PanelSkeleton rows={3} />
        ) : (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="这一卷还没有章节"
            description="先在写作页建章，或在这里直接新建；章纲会跟着章节走。"
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={openCreate}>
                  新建章节
                </Button>
                <a href={`/editor/${novelId}`}>
                  <Button variant="secondary" size="sm" icon={<PenLine className="size-3.5" />}>
                    去写作页
                  </Button>
                </a>
              </div>
            }
            className="border-0 bg-transparent px-2 py-6"
          />
        )
      ) : (
        <div className="scroll-thin max-h-[248px] space-y-0.5 overflow-auto pr-1">
          {scopeChapters.map((chapter) => {
            const active = chapter.id === selectedChapterId;
            const filled = blueprintFilled.has(chapter.id);
            return (
              <button
                key={chapter.id}
                ref={active ? activeRowRef : undefined}
                type="button"
                onClick={() => onSelectChapter(chapter.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                  active ? "bg-accent-soft" : "hover:bg-surface-2",
                )}
              >
                <span className={cn("w-5 shrink-0 text-[11px] tabular-nums", active ? "text-accent" : "text-ink-3")}>
                  {chapter.orderIndex + 1}
                </span>
                <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[chapter.status])} title={STATUS_LABEL[chapter.status]} />
                <span className={cn("min-w-0 flex-1 truncate text-[12.5px]", active ? "font-medium text-ink" : "text-ink-2")}>
                  {stripChapterNumber(chapter.title)}
                </span>
                <span className="shrink-0 text-[10.5px] tabular-nums text-ink-3">{formatWords(chapter.wordCount)}</span>
                {filled ? <Badge tone="jade">章纲</Badge> : <span className="shrink-0 text-[10.5px] text-ink-3">待写</span>}
              </button>
            );
          })}
        </div>
      )}

      {selectedChapter ? (
        <div className="border-t border-line pt-3.5">
          <BlueprintEditor
            key={selectedChapter.id}
            novelId={novelId}
            chapter={selectedChapter}
            chapters={chapters}
            foreshadows={foreshadows}
            onSaved={onBlueprintSaved}
            onDirtyChange={onDirtyChange}
          />
        </div>
      ) : scopeChapters.length > 0 ? (
        <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-[12.5px] text-ink-3">
          从上方选择一个章节开始写章纲。
        </p>
      ) : null}

      <Dialog
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        title="新建章节"
        description="先建一个空章，章纲、正文都可以稍后补；章序按创建顺序。"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={creating} onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button variant="primary" size="sm" loading={creating} disabled={!newTitle.trim()} onClick={createChapter}>
              创建
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            autoFocus
            label="章节名"
            value={newTitle}
            placeholder="例如：旧码头"
            onChange={(event) => setNewTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void createChapter();
            }}
          />
          <Select
            label="所属分卷"
            value={newVolumeId}
            onChange={(event) => setNewVolumeId(event.target.value)}
            options={volumes.map((volume) => ({ value: volume.id, label: volume.title }))}
            placeholder={volumes.length === 0 ? "还没有分卷，可先不归属" : "选择分卷"}
          />
        </div>
      </Dialog>
    </PanelCard>
  );
}
