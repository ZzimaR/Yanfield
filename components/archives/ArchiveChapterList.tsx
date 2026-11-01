"use client";

/**
 * 档案页左栏：章节列表（状态点、档案状态、过期标记、冲突标记）
 */
import { AlertTriangle, Archive, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/kit";
import type { Chapter, StoryArchive } from "@/lib/types";
import { cn } from "@/lib/ui/cn";
import { stripChapterNumber } from "@/components/outline/form-kit";

const STATUS_DOT: Record<Chapter["status"], string> = {
  draft: "bg-ink-4",
  revising: "bg-gold",
  done: "bg-jade",
};

export function ArchiveChapterList({
  chapters,
  archivesByChapter,
  selectedChapterId,
  onSelect,
  loading,
}: {
  chapters: Chapter[];
  archivesByChapter: Map<string, StoryArchive>;
  selectedChapterId: string | null;
  onSelect: (chapter: Chapter) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-[62px] w-full" />
        ))}
      </div>
    );
  }

  if (chapters.length === 0) {
    return <p className="px-1 py-6 text-center text-[12.5px] text-ink-3">这本书还没有章节。</p>;
  }

  return (
    <ul className="space-y-1">
      {chapters.map((chapter) => {
        const archive = archivesByChapter.get(chapter.id);
        const active = chapter.id === selectedChapterId;
        const stale = archive?.status === "stale";
        const hasConflict = Boolean(archive && archive.conflicts.length > 0);
        return (
          <li key={chapter.id}>
            <button
              type="button"
              onClick={() => onSelect(chapter)}
              className={cn(
                "w-full rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                active
                  ? "border-accent bg-accent-soft/40"
                  : "border-transparent hover:border-line hover:bg-surface-2",
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[chapter.status] ?? "bg-ink-4")} aria-hidden />
                <span className="shrink-0 text-[10.5px] tabular-nums text-ink-3">{chapter.orderIndex + 1}</span>
                <span className={cn("min-w-0 flex-1 truncate text-[12.5px]", active ? "font-medium text-ink" : "text-ink-2")}>
                  {stripChapterNumber(chapter.title)}
                </span>
                {archive ? (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-0.5 rounded-xs px-1 py-0.5 text-[10px]",
                      stale ? "bg-gold-soft text-gold" : "bg-jade-soft text-jade",
                    )}
                  >
                    <Archive className="size-2.5" />
                    {stale ? "过期" : "已建"}
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-ink-3">
                    <FileText className="size-2.5" />
                    未建
                  </span>
                )}
                {hasConflict ? <AlertTriangle className="size-3 shrink-0 text-danger" aria-label="有冲突待确认" /> : null}
              </div>
              <p className="mt-0.5 truncate pl-3 text-[10.5px] text-ink-3">
                {archive ? archive.chapterSummary || "档案暂无摘要" : "尚未提取本章档案"}
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
