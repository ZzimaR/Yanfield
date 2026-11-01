"use client";

/**
 * 三级大纲工作台：总纲 / 卷纲 / 章纲
 *
 * 数据来源（全部经 useApi + useDataChanged 刷新）：
 * - /api/outlines/novel/[novelId]
 * - /api/volumes?novelId= · /api/outlines/volume/[volumeId]
 * - /api/chapters?novelId= · /api/chapters/[id]/blueprint
 * - /api/foreshadows?novelId=（章纲里的伏笔埋/收关联）
 */
import * as React from "react";
import { AlertTriangle, Layers, Sparkles } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge, ConfirmDialog, Progress, Select, Skeleton } from "@/components/ui/kit";
import { useApi, useDataChanged } from "@/lib/client/api";
import type { Chapter, Foreshadow, NovelOutline, Volume } from "@/lib/types";
import { ChapterPanel } from "@/components/outline/ChapterPanel";
import { NovelOutlinePanel } from "@/components/outline/NovelOutlinePanel";
import { VolumePanel } from "@/components/outline/VolumePanel";
import {
  PageHeader,
  PanelSkeleton,
  StatCard,
  reindexChaptersByVolume,
  stripChapterNumber,
  useErrorToast,
} from "@/components/outline/form-kit";
import { useBlueprintIndex } from "@/components/outline/use-blueprint-index";

export function OutlineWorkspace({
  novelId,
  initialChapterId,
}: {
  novelId: string;
  initialChapterId?: string | null;
}) {
  const encoded = encodeURIComponent(novelId);
  const outlineApi = useApi<NovelOutline>(`/api/outlines/novel/${encoded}`);
  const volumesApi = useApi<{ items: Volume[] }>(`/api/volumes?novelId=${encoded}`);
  const chaptersApi = useApi<{ items: Chapter[] }>(`/api/chapters?novelId=${encoded}`);
  const foreshadowsApi = useApi<{ items: Foreshadow[] }>(`/api/foreshadows?novelId=${encoded}`);

  const volumes = React.useMemo(() => volumesApi.data?.items ?? [], [volumesApi.data]);
  // 全书统一章号：chapter.orderIndex 只在卷内唯一，展示与跳转前先按分卷重排
  const chapters = React.useMemo(
    () => reindexChaptersByVolume(chaptersApi.data?.items ?? [], volumes),
    [chaptersApi.data, volumes],
  );
  const foreshadows = React.useMemo(() => foreshadowsApi.data?.items ?? [], [foreshadowsApi.data]);

  const [volumePick, setVolumePick] = React.useState<string | null | undefined>(undefined);
  const [selectedChapterId, setSelectedChapterId] = React.useState<string | null>(null);
  const [pendingVolumeId, setPendingVolumeId] = React.useState<string | null>(null);
  const [pendingChapterId, setPendingChapterId] = React.useState<string | null>(null);
  const volumeDirtyRef = React.useRef(false);
  const chapterDirtyRef = React.useRef(false);
  const [blueprintVersion, setBlueprintVersion] = React.useState(0);

  const suggestedVolumeId = React.useMemo(() => {
    if (initialChapterId) {
      const chapter = chapters.find((item) => item.id === initialChapterId);
      if (chapter?.volumeId) return chapter.volumeId;
    }
    return volumes[0]?.id ?? null;
  }, [initialChapterId, chapters, volumes]);

  const activeVolumeId = volumePick === undefined ? suggestedVolumeId : volumePick;

  const scopeChapters = React.useMemo(
    () => (activeVolumeId ? chapters.filter((chapter) => chapter.volumeId === activeVolumeId) : chapters),
    [chapters, activeVolumeId],
  );

  const activeChapterId = React.useMemo(() => {
    if (selectedChapterId && chapters.some((chapter) => chapter.id === selectedChapterId)) return selectedChapterId;
    if (initialChapterId && chapters.some((chapter) => chapter.id === initialChapterId)) return initialChapterId;
    return scopeChapters[0]?.id ?? chapters[0]?.id ?? null;
  }, [selectedChapterId, chapters, scopeChapters, initialChapterId]);

  const blueprintIndex = useBlueprintIndex(chapters, blueprintVersion);

  useDataChanged(
    React.useCallback(() => {
      void volumesApi.refresh();
      void chaptersApi.refresh();
      void outlineApi.refresh();
      void foreshadowsApi.refresh();
    }, [volumesApi.refresh, chaptersApi.refresh, outlineApi.refresh, foreshadowsApi.refresh]),
  );

  useErrorToast(outlineApi.error ?? volumesApi.error ?? chaptersApi.error ?? foreshadowsApi.error);

  const applyVolume = React.useCallback((volumeId: string | null) => {
    setVolumePick(volumeId);
    setSelectedChapterId(null);
    volumeDirtyRef.current = false;
  }, []);

  const requestVolume = React.useCallback(
    (volumeId: string | null) => {
      if (volumeId === activeVolumeId) return;
      if (volumeDirtyRef.current) {
        setPendingVolumeId(volumeId ?? "");
        return;
      }
      applyVolume(volumeId);
    },
    [activeVolumeId, applyVolume],
  );

  const applyChapter = React.useCallback(
    (chapterId: string) => {
      const chapter = chapters.find((item) => item.id === chapterId);
      setSelectedChapterId(chapterId);
      if (chapter) setVolumePick(chapter.volumeId);
      chapterDirtyRef.current = false;
    },
    [chapters],
  );

  const requestChapter = React.useCallback(
    (chapterId: string) => {
      if (chapterId === activeChapterId) return;
      if (chapterDirtyRef.current) {
        setPendingChapterId(chapterId);
        return;
      }
      applyChapter(chapterId);
    },
    [activeChapterId, applyChapter],
  );

  const handleVolumeDirty = React.useCallback((dirty: boolean) => {
    volumeDirtyRef.current = dirty;
  }, []);

  const handleChapterDirty = React.useCallback((dirty: boolean) => {
    chapterDirtyRef.current = dirty;
  }, []);

  const handleBlueprintSaved = React.useCallback(() => {
    setBlueprintVersion((value) => value + 1);
    void chaptersApi.refresh();
  }, [chaptersApi.refresh]);

  const writtenChapters = chapters.filter((chapter) => chapter.wordCount > 0).length;
  const unpaidForeshadows = foreshadows.filter((item) => item.status === "planted" || item.status === "advanced").length;
  const filledCount = blueprintIndex.filled.size;
  const coveragePercent = blueprintIndex.total > 0 ? Math.round((filledCount / blueprintIndex.total) * 100) : 0;

  const initialLoading =
    (outlineApi.loading && !outlineApi.data) ||
    (volumesApi.loading && volumes.length === 0) ||
    (chaptersApi.loading && chapters.length === 0);

  const volumeSelectOptions = [
    { value: "__all__", label: "全部章节" },
    ...volumes.map((volume) => ({ value: volume.id, label: volume.title })),
  ];
  const chapterSelectOptions = scopeChapters.map((chapter) => ({
    value: chapter.id,
    label: `第 ${chapter.orderIndex + 1} 章 · ${stripChapterNumber(chapter.title)}`,
  }));

  return (
    <AppShell novelId={novelId} active="outline">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-6 md:py-6 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-accent/60 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-accent/60">
        {initialLoading ? (
          <>
            <div className="space-y-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-[68px] rounded-lg" />
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
              <PanelSkeleton rows={5} />
              <PanelSkeleton rows={4} />
              <PanelSkeleton rows={6} />
            </div>
          </>
        ) : (
          <>
            <PageHeader
              title="三级大纲"
              badge={<Badge tone="accent">总纲 · 卷纲 · 章纲</Badge>}
              description="先定方向，再拆节奏，最后落到每一章的分场与钩子。AI 写作会按这里的大纲执行。"
              actions={
                <>
                  <div className="w-36">
                    <Select
                      aria-label="快速跳转分卷"
                      value={activeVolumeId ?? "__all__"}
                      onChange={(event) => requestVolume(event.target.value === "__all__" ? null : event.target.value)}
                      options={volumeSelectOptions}
                    />
                  </div>
                  <div className="w-44">
                    <Select
                      aria-label="快速跳转章节"
                      value={activeChapterId ?? ""}
                      onChange={(event) => requestChapter(event.target.value)}
                      options={chapterSelectOptions}
                      placeholder="选择章节"
                    />
                  </div>
                  <a
                    href={`/novel/${novelId}/bible`}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-[12.5px] text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
                  >
                    <Layers className="size-3.5 text-jade" />
                    设定库
                  </a>
                </>
              }
            />

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatCard label="分卷" value={volumes.length} hint="一卷一个阶段目标" />
              <StatCard label="章节" value={chapters.length} hint={`已写正文 ${writtenChapters} 章`} />
              <StatCard
                label="章纲覆盖"
                value={
                  blueprintIndex.loading && filledCount === 0 ? (
                    <span className="text-[15px] text-ink-3">统计中…</span>
                  ) : (
                    `${filledCount}/${blueprintIndex.total}`
                  )
                }
                hint={blueprintIndex.partial ? "章节较多，仅统计前 80 章" : `覆盖率 ${coveragePercent}%`}
                accent="jade"
                loading={false}
              />
              <StatCard label="伏笔" value={foreshadows.length} hint={`待回收 ${unpaidForeshadows} 条`} accent="gold" />
            </div>

            {blueprintIndex.total > 0 ? (
              <div className="mt-2.5 flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2">
                <Sparkles className="size-3.5 shrink-0 text-accent" />
                <span className="shrink-0 text-[11.5px] text-ink-3">章纲完成度</span>
                <Progress value={filledCount} max={blueprintIndex.total} tone="jade" className="min-w-0 flex-1" />
                <span className="shrink-0 text-[11.5px] tabular-nums text-ink-3">
                  {filledCount}/{blueprintIndex.total}
                </span>
              </div>
            ) : null}

            <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
              <NovelOutlinePanel
                novelId={novelId}
                outline={outlineApi.data}
                loading={outlineApi.loading}
                error={outlineApi.error}
                onSaved={(outline) => outlineApi.setData(outline)}
                onRetry={() => void outlineApi.refresh()}
              />

              <VolumePanel
                novelId={novelId}
                volumes={volumes}
                chapters={chapters}
                selectedVolumeId={activeVolumeId}
                onSelectVolume={(volumeId) => requestVolume(volumeId)}
                onVolumesChanged={() => void volumesApi.refresh()}
                onDirtyChange={handleVolumeDirty}
                loading={volumesApi.loading}
              />

              <ChapterPanel
                novelId={novelId}
                chapters={chapters}
                volumes={volumes}
                activeVolumeId={activeVolumeId}
                selectedChapterId={activeChapterId}
                onSelectChapter={(chapterId) => requestChapter(chapterId)}
                foreshadows={foreshadows}
                blueprintFilled={blueprintIndex.filled}
                onChaptersChanged={() => void chaptersApi.refresh()}
                onBlueprintSaved={handleBlueprintSaved}
                onDirtyChange={handleChapterDirty}
                loading={chaptersApi.loading}
              />
            </div>

            {volumesApi.error && volumes.length > 0 ? (
              <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-danger">
                <AlertTriangle className="size-3.5" />
                {volumesApi.error}
              </p>
            ) : null}
          </>
        )}
      </div>

      <ConfirmDialog
        open={pendingVolumeId !== null}
        title="切换分卷？"
        description="当前卷纲有未保存的修改，切换后会丢失。"
        confirmText="仍然切换"
        danger
        onConfirm={() => {
          const target = pendingVolumeId;
          setPendingVolumeId(null);
          if (target) applyVolume(target);
        }}
        onClose={() => setPendingVolumeId(null)}
      />
      <ConfirmDialog
        open={pendingChapterId !== null}
        title="切换章节？"
        description="当前章纲有未保存的修改，切换后会丢失。"
        confirmText="仍然切换"
        danger
        onConfirm={() => {
          const target = pendingChapterId;
          setPendingChapterId(null);
          if (target) applyChapter(target);
        }}
        onClose={() => setPendingChapterId(null)}
      />
    </AppShell>
  );
}
