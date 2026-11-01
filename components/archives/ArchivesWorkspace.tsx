"use client";

/**
 * 故事档案工作台
 * 数据：GET /api/chapters?novelId=、GET /api/archives?novelId=
 * 提取：POST /api/ai/archives/extract（SSE，服务端抽取后直接 upsert 档案）
 * 一键补建：按章节顺序串行提取缺失档案，显示进度并可中止
 */
import * as React from "react";
import {
  AlertTriangle,
  Archive,
  CircleAlert,
  FileWarning,
  History,
  Info,
  RefreshCw,
  Sparkles,
  Square,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge, Button, EmptyState, Progress, Segmented, Tooltip, useToast } from "@/components/ui/kit";
import { useApi, useDataChanged } from "@/lib/client/api";
import type { Chapter, StoryArchive, Volume } from "@/lib/types";
import { ArchiveChapterList } from "@/components/archives/ArchiveChapterList";
import { ArchiveDetail } from "@/components/archives/ArchiveDetail";
import { extractChapterArchive } from "@/components/archives/extract";
import {
  PageHeader,
  StatCard,
  reindexChaptersByVolume,
  stripChapterNumber,
  useErrorToast,
} from "@/components/outline/form-kit";

type ArchiveFilter = "all" | "stale" | "conflict";

const FILTER_OPTIONS: { value: ArchiveFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "stale", label: "已过期" },
  { value: "conflict", label: "有冲突" },
];

const RULES = [
  { title: "只记正文写过的事", detail: "档案不补脑补设定，没写进正文的不进档案。" },
  { title: "推不出的进待确认", detail: "正文没交代清的，标成待确认，不用推测替作者决定。" },
  { title: "冲突必须列原句", detail: "档案与正文不一致时，保留原句与出处，交给人工裁决。" },
  { title: "改章就标过期", detail: "章节正文改动后，该章档案自动标记过期，提醒重新提取。" },
];

export function ArchivesWorkspace({ novelId }: { novelId: string }) {
  const { toast } = useToast();
  const queryString = `?novelId=${encodeURIComponent(novelId)}`;
  const chaptersApi = useApi<{ items: Chapter[] }>(`/api/chapters${queryString}`);
  const archivesApi = useApi<{ items: StoryArchive[] }>(`/api/archives${queryString}`);
  const volumesApi = useApi<{ items: Volume[] }>(`/api/volumes${queryString}`);

  useErrorToast(chaptersApi.error, "章节加载失败");
  useErrorToast(archivesApi.error, "档案加载失败");

  const refreshAll = React.useCallback(() => {
    void chaptersApi.refresh();
    void archivesApi.refresh();
    void volumesApi.refresh();
  }, [archivesApi, chaptersApi, volumesApi]);
  useDataChanged(refreshAll);

  const volumes = React.useMemo(() => volumesApi.data?.items ?? [], [volumesApi.data]);
  // 全书统一章号：chapter.orderIndex 只在卷内唯一，按分卷重排后再编号与排序
  const chapters = React.useMemo(
    () => reindexChaptersByVolume(chaptersApi.data?.items ?? [], volumes),
    [chaptersApi.data, volumes],
  );
  const archives = React.useMemo(() => archivesApi.data?.items ?? [], [archivesApi.data]);
  const archivesByChapter = React.useMemo(() => {
    const map = new Map<string, StoryArchive>();
    for (const archive of archives) {
      if (archive.chapterId) map.set(archive.chapterId, archive);
    }
    return map;
  }, [archives]);

  const [filter, setFilter] = React.useState<ArchiveFilter>("all");
  const [selectedChapterId, setSelectedChapterId] = React.useState<string | null>(null);
  const [building, setBuilding] = React.useState(false);
  const [buildState, setBuildState] = React.useState<{
    processed: number;
    total: number;
    done: number;
    failed: number;
    currentTitle: string;
  } | null>(null);
  const [extractingChapterId, setExtractingChapterId] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  React.useEffect(() => {
    if (selectedChapterId || chapters.length === 0) return;
    const firstArchived = chapters.find((chapter) => archivesByChapter.has(chapter.id));
    setSelectedChapterId((firstArchived ?? chapters[0]).id);
  }, [archivesByChapter, chapters, selectedChapterId]);

  const archivedCount = archivesByChapter.size;
  const staleCount = archives.filter((archive) => archive.status === "stale").length;
  const conflictCount = archives.filter((archive) => archive.conflicts.length > 0).length;
  const missingCount = chapters.filter((chapter) => !archivesByChapter.has(chapter.id)).length;
  const coverage = chapters.length > 0 ? Math.round((archivedCount / chapters.length) * 100) : 0;

  const filteredChapters = React.useMemo(() => {
    if (filter === "all") return chapters;
    return chapters.filter((chapter) => {
      const archive = archivesByChapter.get(chapter.id);
      if (!archive) return false;
      if (filter === "stale") return archive.status === "stale";
      return archive.conflicts.length > 0;
    });
  }, [archivesByChapter, chapters, filter]);

  const selectedChapter = chapters.find((chapter) => chapter.id === selectedChapterId);
  const selectedArchive = selectedChapterId ? archivesByChapter.get(selectedChapterId) : undefined;

  const extractOne = async (chapter: Chapter) => {
    if (!chapter.content.trim()) {
      toast({ title: "本章还没有正文", description: "先写正文，再提取档案。", tone: "error" });
      return;
    }
    setExtractingChapterId(chapter.id);
    try {
      const result = await extractChapterArchive({ novelId, chapterId: chapter.id });
      if (result.ok) {
        toast({ title: "档案已提取", description: chapter.title, tone: "success" });
        await archivesApi.refresh();
      } else {
        toast({ title: "提取档案失败", description: result.error, tone: "error" });
      }
    } finally {
      setExtractingChapterId(null);
    }
  };

  const buildAll = async () => {
    const targets = chapters.filter((chapter) => !archivesByChapter.has(chapter.id) && chapter.content.trim());
    if (targets.length === 0) {
      toast({
        title: "没有需要补建的档案",
        description: missingCount > 0 ? "剩余章节还没有正文，写完再补建。" : "全书档案都已建好。",
        tone: "default",
      });
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setBuilding(true);
    let done = 0;
    let failed = 0;
    let processed = 0;
    try {
      for (const chapter of targets) {
        if (controller.signal.aborted) break;
        processed += 1;
        setBuildState({ processed, total: targets.length, done, failed, currentTitle: chapter.title || "未命名章节" });
        const result = await extractChapterArchive({ novelId, chapterId: chapter.id, signal: controller.signal });
        if (result.ok) done += 1;
        else if (result.error !== "已中止") failed += 1;
        await archivesApi.refresh();
      }
    } finally {
      const aborted = controller.signal.aborted;
      abortRef.current = null;
      setBuilding(false);
      setBuildState(null);
      if (aborted) {
        toast({ title: "已中止补建", description: `本次完成 ${done} 章，失败 ${failed} 章。`, tone: "default" });
      } else {
        toast({
          title: "补建完成",
          description: `成功 ${done} 章${failed > 0 ? `，失败 ${failed} 章（多为正文为空或模型返回异常）` : ""}。`,
          tone: failed > 0 ? "error" : "success",
        });
      }
    }
  };

  const rulesCard = (
    <div className="rounded-md border border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
        <Info className="size-3.5 text-ink-3" />
        档案只服务于「已经写出来的故事」
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {RULES.map((rule) => (
          <div key={rule.title}>
            <p className="text-[11.5px] font-medium text-ink-2">{rule.title}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{rule.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <AppShell novelId={novelId} active="archives">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-6 md:py-6 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-accent/60 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-accent/60">
        <PageHeader
          title="故事档案"
          badge={<Badge tone="gold">连续性</Badge>}
          description="逐章记录已发生的事实：人物状态、设定变动、人情账与时间线。后续写作与 AI 上下文都以这里为准。"
          actions={
            <div className="flex items-center gap-1.5">
              <Tooltip
                side="bottom"
                align="end"
                multiline
                label="只给已经写了正文、还没有档案的章节建档。已有档案的会跳过，空章也会跳过。所以如果都建好了，点下去会马上结束，不会再请求模型，也不会改正文。有缺档时才按章节顺序逐章提取，每章算一次 AI 用量。"
              >
                <span
                  className="inline-flex size-7 cursor-help items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
                  aria-label="一键补建说明"
                >
                  <CircleAlert className="size-4" />
                </span>
              </Tooltip>
              <Button
                variant="primary"
                size="sm"
                icon={<Sparkles className="size-3.5" />}
                loading={building}
                disabled={building || chapters.length === 0}
                onClick={() => void buildAll()}
              >
                一键补建全书档案
              </Button>
            </div>
          }
        />

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="已建档案"
            value={`${archivedCount}/${chapters.length}`}
            hint={`覆盖率 ${coverage}%`}
            loading={chaptersApi.loading && !chaptersApi.data}
          />
          <StatCard
            label="待补建"
            value={missingCount}
            hint="章节顺序补建"
            accent="gold"
            loading={chaptersApi.loading && !chaptersApi.data}
          />
          <StatCard
            label="已过期"
            value={staleCount}
            hint="正文改动后需重提取"
            accent="gold"
            loading={archivesApi.loading && !archivesApi.data}
          />
          <StatCard
            label="待确认冲突"
            value={conflictCount}
            hint="档案与正文不一致"
            loading={archivesApi.loading && !archivesApi.data}
          />
        </div>

        <div className="mt-3">
          <Progress value={archivedCount} max={Math.max(chapters.length, 1)} tone="jade" />
        </div>

        <div className="mt-4">{rulesCard}</div>

        {building && buildState ? (
          <div className="mt-4 rounded-md border border-line bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <History className="size-3.5 text-accent" />
              <span className="text-[12.5px] font-medium text-ink">正在补建档案</span>
              <span className="text-[11.5px] text-ink-3">
                {buildState.processed}/{buildState.total} · 当前：{buildState.currentTitle}
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto"
                icon={<Square className="size-3" />}
                onClick={() => abortRef.current?.abort()}
              >
                中止
              </Button>
            </div>
            <div className="mt-2">
              <Progress value={buildState.processed} max={Math.max(buildState.total, 1)} tone="accent" />
            </div>
            <p className="mt-1.5 text-[11px] text-ink-3">
              成功 {buildState.done} 章 · 失败 {buildState.failed} 章 · 每章提取完成后立即写入档案
            </p>
          </div>
        ) : null}

        {chaptersApi.error && !chaptersApi.data ? (
          <div className="mt-4 rounded-md border border-line bg-surface px-4 py-3 text-[12.5px] text-ink-3">
            章节列表加载失败：{chaptersApi.error}
            <Button variant="ghost" size="sm" className="ml-2" onClick={() => void chaptersApi.refresh()}>
              重试
            </Button>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-[290px_1fr]">
          <aside className="min-w-0">
            <div className="rounded-md border border-line bg-surface">
              <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink">
                  <Archive className="size-3.5 text-ink-3" />
                  章节档案
                </span>
                <span className="text-[10.5px] tabular-nums text-ink-3">
                  {archivedCount}/{chapters.length}
                </span>
              </div>
              <div className="px-2 py-2">
                <Segmented
                  options={FILTER_OPTIONS.map((item) => ({
                    ...item,
                    label:
                      item.value === "stale"
                        ? `已过期 ${staleCount}`
                        : item.value === "conflict"
                          ? `有冲突 ${conflictCount}`
                          : "全部",
                  }))}
                  value={filter}
                  onChange={(value) => setFilter(value as ArchiveFilter)}
                  size="sm"
                />
              </div>
              <div className="max-h-[560px] overflow-y-auto px-1.5 pb-2 scroll-thin">
                <ArchiveChapterList
                  chapters={filteredChapters}
                  archivesByChapter={archivesByChapter}
                  selectedChapterId={selectedChapterId}
                  onSelect={(chapter) => setSelectedChapterId(chapter.id)}
                  loading={chaptersApi.loading && !chaptersApi.data}
                />
                {filter !== "all" && filteredChapters.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11.5px] text-ink-3">
                    {filter === "stale" ? "没有过期档案。" : "没有待确认冲突。"}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-3 rounded-md border border-line bg-surface-2 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-3">
                <AlertTriangle className="size-3 text-gold" />
                过期档案不会自动更新
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
                正文改动后，该章档案会标记为「已过期」；重新提取前，它仍按旧事实参与上下文。
              </p>
            </div>
          </aside>

          <section className="min-w-0">
            {archivesApi.error && !archivesApi.data ? (
              <div className="rounded-md border border-line bg-surface px-4 py-6 text-center text-[12.5px] text-ink-3">
                档案加载失败：{archivesApi.error}
                <Button variant="ghost" size="sm" className="ml-2" onClick={() => void archivesApi.refresh()}>
                  重试
                </Button>
              </div>
            ) : !selectedChapter ? (
              <EmptyState
                icon={<FileWarning className="size-5" />}
                title={chaptersApi.loading ? "正在加载章节…" : "这本书还没有章节"}
                description={
                  chaptersApi.loading
                    ? "稍等片刻。"
                    : "先在写作页建好章节并写入正文，再回到这里提取档案。"
                }
              />
            ) : selectedArchive ? (
              <ArchiveDetail
                novelId={novelId}
                archive={selectedArchive}
                chapter={selectedChapter}
                chapterNo={selectedChapter.orderIndex + 1}
                onChanged={() => void archivesApi.refresh()}
              />
            ) : (
              <EmptyState
                icon={<Archive className="size-5" />}
                title={`第 ${selectedChapter.orderIndex + 1} 章 · ${stripChapterNumber(selectedChapter.title)}`}
                description={
                  selectedChapter.content.trim()
                    ? "本章还没有档案。提取后，人物状态、设定变动与时间线会被记录，后续写作直接引用。"
                    : "本章还没有正文。先写出至少一段内容，再提取档案。"
                }
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Sparkles className="size-3.5" />}
                    loading={extractingChapterId === selectedChapter.id}
                    disabled={!selectedChapter.content.trim() || extractingChapterId !== null}
                    onClick={() => void extractOne(selectedChapter)}
                  >
                    提取本章档案
                  </Button>
                }
              />
            )}
          </section>
        </div>

        <p className="mt-6 flex items-center gap-1.5 text-[11px] text-ink-3">
          <RefreshCw className="size-3" />
          档案数据以接口返回为准；冲突与过期标记不会自动改写正文或档案内容。
        </p>
      </div>
    </AppShell>
  );
}
