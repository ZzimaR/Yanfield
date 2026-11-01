"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, MapPin, Pencil, ScrollText, User } from "lucide-react";
import { Badge, Button, EmptyState, Input, Sheet, Skeleton } from "@/components/ui/kit";
import { useApi, useDataChanged } from "@/lib/client/api";
import { toItems } from "@/lib/editor/normalize";
import {
  CHARACTER_ROLE_LABEL,
  FORESHADOW_STATUS_LABEL,
  WORLD_CATEGORY_LABEL,
  type Chapter,
  type Character,
  type Foreshadow,
  type Volume,
  type WorldSetting,
} from "@/lib/types";
import { cn } from "@/lib/ui/cn";
import { reindexChaptersByVolume, sortChaptersByVolume } from "@/components/outline/form-kit";
import { CharacterEditor } from "@/components/cards/CharacterEditor";
import { WorldEditor } from "@/components/cards/WorldEditor";
import { ForeshadowEditor } from "@/components/cards/ForeshadowEditor";

interface CodexPanelProps {
  novelId: string;
}

/** 设定条目：角色 / 世界观 / 伏笔 三类 */
type CodexEntry =
  | { kind: "character"; data: Character }
  | { kind: "world"; data: WorldSetting }
  | { kind: "foreshadow"; data: Foreshadow };

interface FieldRow {
  label: string;
  value: string;
}

const KIND_LABEL: Record<CodexEntry["kind"], string> = {
  character: "角色",
  world: "世界观",
  foreshadow: "伏笔",
};

/** 列表行左侧的 8px 色点：角色 accent、世界观 jade、伏笔 gold */
const KIND_DOT_CLASS: Record<CodexEntry["kind"], string> = {
  character: "bg-accent",
  world: "bg-jade",
  foreshadow: "bg-gold",
};

/** 主色链接按钮样式（与 kit Button primary 视觉一致，但不嵌套 Button） */
const PRIMARY_LINK_CLASS =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-sm bg-accent px-3.5 text-[13px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 motion-reduce:transition-none";

/** 次级链接样式（与 kit Button secondary 视觉一致） */
const SECONDARY_LINK_CLASS =
  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-line bg-surface px-2.5 text-[12px] text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 motion-reduce:transition-none";

/** 设定详情面板要展示的字段（按类别） */
function buildFields(entry: CodexEntry): FieldRow[] {
  if (entry.kind === "character") {
    const c = entry.data;
    return [
      { label: "角色类型", value: CHARACTER_ROLE_LABEL[c.role] },
      { label: "身份", value: c.identity },
      { label: "年龄 / 性别", value: [c.age, c.gender].filter(Boolean).join(" · ") },
      { label: "性格与行事逻辑", value: c.personality },
      { label: "目标", value: c.goals },
      { label: "秘密", value: c.secrets },
      { label: "人物弧光", value: c.arc },
      { label: "说话风格", value: c.speechStyle },
      { label: "当前状态", value: c.currentState },
      { label: "别名", value: c.aliases.join(" / ") },
      { label: "标签", value: c.tags.join(" / ") },
    ];
  }
  if (entry.kind === "world") {
    const w = entry.data;
    return [
      { label: "分类", value: WORLD_CATEGORY_LABEL[w.category] },
      { label: "简述", value: w.summary },
      { label: "内容", value: w.content },
      { label: "标签", value: w.tags.join(" / ") },
    ];
  }
  const f = entry.data;
  return [
    { label: "状态", value: FORESHADOW_STATUS_LABEL[f.status] },
    { label: "描述", value: f.description },
    { label: "备注", value: f.notes },
  ];
}

/** 列表里每行的主标题 + 副标题（副标题始终有值，保证行高稳定） */
function entryPreview(entry: CodexEntry): { name: string; hint: string } {
  if (entry.kind === "character") {
    const c = entry.data;
    return {
      name: c.name,
      hint: c.identity || c.currentState || CHARACTER_ROLE_LABEL[c.role],
    };
  }
  if (entry.kind === "world") {
    const w = entry.data;
    return { name: w.title, hint: w.summary || WORLD_CATEGORY_LABEL[w.category] };
  }
  const f = entry.data;
  return {
    name: f.title,
    hint: f.description || FORESHADOW_STATUS_LABEL[f.status],
  };
}

function entryMatches(entry: CodexEntry, keyword: string): boolean {
  if (!keyword) return true;
  if (entry.kind === "character") {
    const c = entry.data;
    return [c.name, c.identity, c.personality, c.goals, c.currentState, c.aliases.join(" "), c.tags.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  }
  if (entry.kind === "world") {
    const w = entry.data;
    return [w.title, w.summary, w.content, w.tags.join(" ")].join(" ").toLowerCase().includes(keyword);
  }
  const f = entry.data;
  return [f.title, f.description, f.notes].join(" ").toLowerCase().includes(keyword);
}

/**
 * 左栏「设定」：角色 / 世界观 / 伏笔 的分组速查。
 * 点击条目打开详情抽屉；抽屉里可直接编辑（复用设定集同一套编辑器），也可跳转设定集深挖。
 */
export function CodexPanel({ novelId }: CodexPanelProps) {
  const charactersApi = useApi<unknown>(`/api/characters?novelId=${encodeURIComponent(novelId)}`);
  const worldApi = useApi<unknown>(`/api/world?novelId=${encodeURIComponent(novelId)}`);
  const foreshadowsApi = useApi<unknown>(`/api/foreshadows?novelId=${encodeURIComponent(novelId)}`);
  const chaptersApi = useApi<unknown>(`/api/chapters?novelId=${encodeURIComponent(novelId)}`);
  const volumesApi = useApi<unknown>(`/api/volumes?novelId=${encodeURIComponent(novelId)}`);

  const characters = React.useMemo(() => toItems<Character>(charactersApi.data), [charactersApi.data]);
  const world = React.useMemo(() => toItems<WorldSetting>(worldApi.data), [worldApi.data]);
  const foreshadows = React.useMemo(() => toItems<Foreshadow>(foreshadowsApi.data), [foreshadowsApi.data]);
  /** 编辑器需要全书章号的章节列表（chapter.orderIndex 只在卷内唯一） */
  const editorChapters = React.useMemo(() => {
    const chapters = toItems<Chapter>(chaptersApi.data);
    const volumes = toItems<Volume>(volumesApi.data);
    return reindexChaptersByVolume(sortChaptersByVolume(chapters, volumes), volumes);
  }, [chaptersApi.data, volumesApi.data]);

  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<CodexEntry | null>(null);
  const [editing, setEditing] = React.useState<CodexEntry | null>(null);

  const refreshAll = React.useCallback(() => {
    void charactersApi.refresh();
    void worldApi.refresh();
    void foreshadowsApi.refresh();
  }, [charactersApi.refresh, worldApi.refresh, foreshadowsApi.refresh]);

  // 设定集页面保存后也能同步刷新左栏
  useDataChanged(() => {
    void charactersApi.refresh();
    void worldApi.refresh();
    void foreshadowsApi.refresh();
  });

  const keyword = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    const pick = <T extends CodexEntry>(list: T[]): T[] => list.filter((entry) => entryMatches(entry, keyword));
    return {
      characters: pick(characters.map((data) => ({ kind: "character" as const, data }))),
      world: pick(world.map((data) => ({ kind: "world" as const, data }))),
      foreshadows: pick(foreshadows.map((data) => ({ kind: "foreshadow" as const, data }))),
    };
  }, [characters, world, foreshadows, keyword]);

  const loading = charactersApi.loading || worldApi.loading || foreshadowsApi.loading;
  const total = characters.length + world.length + foreshadows.length;
  const matched = filtered.characters.length + filtered.world.length + filtered.foreshadows.length;

  const groups: { key: string; title: string; icon: React.ReactNode; entries: CodexEntry[]; total: number }[] = [
    { key: "characters", title: "角色", icon: <User className="size-3.5" />, entries: filtered.characters, total: characters.length },
    { key: "world", title: "世界观", icon: <MapPin className="size-3.5" />, entries: filtered.world, total: world.length },
    { key: "foreshadows", title: "伏笔", icon: <ScrollText className="size-3.5" />, entries: filtered.foreshadows, total: foreshadows.length },
  ];

  const detailFields = selected ? buildFields(selected).filter((row) => row.value.trim().length > 0) : [];
  const detailName =
    selected === null
      ? ""
      : selected.kind === "character"
        ? selected.data.name
        : selected.data.title;
  const detailVisible = selected === null ? true : selected.kind === "foreshadow" ? true : selected.data.aiVisible;
  const detailRevealAt =
    selected === null || selected.kind === "foreshadow" ? null : selected.data.revealAtChapter;

  /** 详情 → 编辑：关掉详情，打开对应编辑器 */
  const startEdit = () => {
    if (!selected) return;
    setEditing(selected);
    setSelected(null);
  };

  const closeEditor = () => setEditing(null);

  const handleSaved = (entry: CodexEntry) => {
    refreshAll();
    setEditing(null);
    setSelected(entry);
  };

  const handleDeleted = () => {
    refreshAll();
    setEditing(null);
    setSelected(null);
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      {/* 头部：条数统计 + 搜索 + 设定集入口 */}
      <div className="shrink-0 space-y-2 border-b border-line px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] tabular-nums text-ink-3">
            {keyword ? `${matched} / ${total} 条` : `${total} 条设定`}
          </span>
          <Link
            href={`/novel/${novelId}/bible`}
            className="inline-flex items-center gap-1 rounded-sm text-[11.5px] text-accent transition-colors duration-150 hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 motion-reduce:transition-none"
          >
            <BookOpen className="size-3" aria-hidden />
            设定集
          </Link>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索角色 / 世界观 / 伏笔"
          aria-label="搜索设定"
          className="h-8 text-[12px]"
        />
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
        {loading && total === 0 ? (
          <div className="space-y-1.5 px-1 py-1">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : total === 0 ? (
          <div className="px-2 py-6">
            <EmptyState
              icon={<BookOpen className="size-5" />}
              title="还没有设定"
              description="先把角色与世界观写进设定集，这里会随写随查。"
              action={
                <Link href={`/novel/${novelId}/bible`} className={PRIMARY_LINK_CLASS}>
                  去建角色
                </Link>
              }
            />
          </div>
        ) : matched === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-ink-3">没有匹配「{query.trim()}」的设定</p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) =>
              group.entries.length === 0 ? null : (
                <section key={group.key} aria-label={group.title}>
                  <div className="mb-1.5 flex items-center gap-1.5 px-2 text-[11px] font-semibold tracking-wide text-ink-3">
                    {group.icon}
                    <span>{group.title}</span>
                    <span className="tabular-nums">{group.entries.length}</span>
                  </div>
                  <div className="space-y-1">
                    {group.entries.map((entry) => {
                      const preview = entryPreview(entry);
                      return (
                        <button
                          key={`${entry.kind}:${entry.data.id}`}
                          type="button"
                          onClick={() => setSelected(entry)}
                          className="group flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 motion-reduce:transition-none"
                        >
                          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", KIND_DOT_CLASS[entry.kind])} aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-medium leading-[1.4] text-ink-2 group-hover:text-ink">
                              {preview.name}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] leading-[1.45] text-ink-3">{preview.hint}</span>
                          </span>
                          <ChevronRight
                            className="mt-[7px] size-3.5 shrink-0 text-ink-4 opacity-0 transition-opacity duration-150 group-hover:opacity-100 motion-reduce:transition-none"
                            aria-hidden
                          />
                        </button>
                      );
                    })}
                  </div>
                </section>
              ),
            )}
          </div>
        )}
      </div>

      {/* 详情抽屉：可直接编辑，也可跳设定集 */}
      <Sheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={detailName}
        width={420}
        footer={
          <div className="flex items-center gap-2 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-accent/40 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-accent/40">
            <Button variant="primary" size="sm" icon={<Pencil className="size-3.5" />} onClick={startEdit}>
              编辑
            </Button>
            <Link href={`/novel/${novelId}/bible`} className={cn(SECONDARY_LINK_CLASS, "ml-auto")}>
              <BookOpen className="size-3.5" aria-hidden />
              在设定集打开
            </Link>
          </div>
        }
      >
        <div className="space-y-3.5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{selected ? KIND_LABEL[selected.kind] : ""}</Badge>
            <Badge tone={detailVisible ? "jade" : "default"}>{detailVisible ? "对 AI 可见" : "对 AI 隐藏"}</Badge>
            {detailRevealAt !== null ? <Badge tone="gold">第 {detailRevealAt} 章起可见</Badge> : null}
          </div>

          {detailFields.length === 0 ? (
            <p className="text-[12px] text-ink-3">这条设定还没有补充细节，点下方「编辑」补充。</p>
          ) : (
            <dl className="grid grid-cols-[82px_minmax(0,1fr)] gap-x-3 gap-y-2">
              {detailFields.map((row) => (
                <React.Fragment key={row.label}>
                  <dt className="pt-[1px] text-[11px] leading-relaxed text-ink-3">{row.label}</dt>
                  <dd className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-ink-2">{row.value}</dd>
                </React.Fragment>
              ))}
            </dl>
          )}
        </div>
      </Sheet>

      {/* 三类编辑器：复用设定集的同一套 Sheet（新建入口不在此处） */}
      <CharacterEditor
        open={editing?.kind === "character"}
        novelId={novelId}
        character={editing?.kind === "character" ? editing.data : null}
        characters={characters}
        chapters={editorChapters}
        onClose={closeEditor}
        onSaved={(saved) => handleSaved({ kind: "character", data: saved })}
        onDeleted={handleDeleted}
      />
      <WorldEditor
        open={editing?.kind === "world"}
        novelId={novelId}
        setting={editing?.kind === "world" ? editing.data : null}
        settings={world}
        chapters={editorChapters}
        onClose={closeEditor}
        onSaved={(saved) => handleSaved({ kind: "world", data: saved })}
        onDeleted={handleDeleted}
      />
      <ForeshadowEditor
        open={editing?.kind === "foreshadow"}
        novelId={novelId}
        foreshadow={editing?.kind === "foreshadow" ? editing.data : null}
        chapters={editorChapters}
        onClose={closeEditor}
        onSaved={(saved) => handleSaved({ kind: "foreshadow", data: saved })}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
