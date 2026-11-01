"use client";

import * as React from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, MapPin, Plus, ScrollText, User } from "lucide-react";
import { EmptyState, Input, Skeleton } from "@/components/ui/kit";
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

/** 列表行左侧的色点：角色、世界观、伏笔各用一种颜色 */
const KIND_DOT_CLASS: Record<CodexEntry["kind"], string> = {
  character: "bg-accent",
  world: "bg-jade",
  foreshadow: "bg-gold",
};

/** 主色链接按钮样式（与 kit Button primary 视觉一致，但不嵌套 Button） */
const PRIMARY_LINK_CLASS =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-sm bg-accent px-3.5 text-[13px] font-medium text-accent-ink transition-colors duration-150 hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 motion-reduce:transition-none";

function worldRows(settings: WorldSetting[]): { setting: WorldSetting; depth: number }[] {
  const byParent = new Map<string | null, WorldSetting[]>();
  for (const setting of settings) {
    const key = setting.parentId;
    const list = byParent.get(key) ?? [];
    list.push(setting);
    byParent.set(key, list);
  }
  const rows: { setting: WorldSetting; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null, depth: number) => {
    for (const setting of byParent.get(parentId) ?? []) {
      if (seen.has(setting.id)) continue;
      seen.add(setting.id);
      rows.push({ setting, depth });
      walk(setting.id, depth + 1);
    }
  };
  walk(null, 0);
  for (const setting of settings) {
    if (!seen.has(setting.id)) rows.push({ setting, depth: 0 });
  }
  return rows;
}

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
 * 点击条目直接打开编辑器，写作时不用先离开章节。
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
  const [editing, setEditing] = React.useState<CodexEntry | null>(null);
  const [creatingWorld, setCreatingWorld] = React.useState(false);

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

  const closeEditor = () => {
    setEditing(null);
    setCreatingWorld(false);
  };

  const handleSaved = (entry: CodexEntry) => {
    refreshAll();
    setCreatingWorld(false);
    setEditing(entry);
  };

  const handleDeleted = () => {
    refreshAll();
    setEditing(null);
    setCreatingWorld(false);
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      {/* 头部：条数统计 + 搜索 + 设定集入口 */}
      <div className="shrink-0 space-y-2 border-b border-line px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] tabular-nums text-ink-3">
            {keyword ? `${matched} / ${total} 条` : `${total} 条设定`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setCreatingWorld(true);
              }}
              className="inline-flex items-center gap-1 rounded-sm text-[11.5px] text-ink-2 transition-colors hover:text-ink"
            >
              <Plus className="size-3" aria-hidden />
              新建设定
            </button>
            <Link
              href={`/novel/${novelId}/bible`}
              className="inline-flex items-center gap-1 rounded-sm text-[11.5px] text-accent transition-colors duration-150 hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 motion-reduce:transition-none"
            >
              <BookOpen className="size-3" aria-hidden />
              设定集
            </Link>
          </div>
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
                    {(group.key === "world" && !keyword
                      ? worldRows(group.entries.map((entry) => entry.data as WorldSetting)).map(({ setting, depth }) => ({
                          entry: { kind: "world" as const, data: setting },
                          depth,
                        }))
                      : group.entries.map((entry) => ({ entry, depth: 0 }))
                    ).map(({ entry, depth }) => {
                      const preview = entryPreview(entry);
                      return (
                        <button
                          key={`${entry.kind}:${entry.data.id}`}
                          type="button"
                          onClick={() => setEditing(entry)}
                          className="group flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 motion-reduce:transition-none"
                          style={{ paddingLeft: 8 + depth * 14 }}
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
        open={creatingWorld || editing?.kind === "world"}
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
