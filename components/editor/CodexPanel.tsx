"use client";

import * as React from "react";
import { MapPin, Plus, ScrollText, User } from "lucide-react";
import { Button, EmptyState, Input, Skeleton } from "@/components/ui/kit";
import { useApi, useDataChanged } from "@/lib/client/api";
import { toItems } from "@/lib/editor/normalize";
import {
  type Chapter,
  type Character,
  type Foreshadow,
  type Volume,
  type WorldSetting,
} from "@/lib/types";
import { cn } from "@/lib/ui/cn";
import { reindexChaptersByVolume, sortChaptersByVolume } from "@/components/outline/form-kit";
import { MaterialPreview } from "@/components/cards/MaterialPreview";
import { CharacterEditor } from "@/components/cards/CharacterEditor";
import { WorldEditor } from "@/components/cards/WorldEditor";
import { ForeshadowEditor } from "@/components/cards/ForeshadowEditor";

interface CodexPanelProps {
  novelId: string;
}

/** 命令面板（⌘K）里点中某张卡后要打开的请求 */
export interface PendingCodexCard {
  novelId: string;
  kind: "character" | "world" | "foreshadow";
  id: string;
}

/**
 * 页签切到「设定」后 CodexPanel 才挂载，数据也还要走 /api：
 * 这段时间里派发的 yantian:open-card 没人接，会直接丢失。派发前先暂存，挂载后取走重试。
 */
let pendingOpenCard: PendingCodexCard | null = null;

export function stashPendingCodexCard(pending: PendingCodexCard): void {
  pendingOpenCard = pending;
}

function takePendingCodexCard(): PendingCodexCard | null {
  const pending = pendingOpenCard;
  pendingOpenCard = null;
  return pending;
}

/** 设定条目：角色 / 世界观 / 伏笔 三类 */
type CodexEntry =
  | { kind: "character"; data: Character }
  | { kind: "world"; data: WorldSetting }
  | { kind: "foreshadow"; data: Foreshadow };

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
  const [creatingCharacter, setCreatingCharacter] = React.useState(false);
  const [creatingForeshadow, setCreatingForeshadow] = React.useState(false);
  /** 外部「打开某张卡」事件先到、数据后到：缓存请求，等 useApi 就绪后重试打开 */
  const pendingCardRef = React.useRef<PendingCodexCard | null>(null);

  const refreshAll = React.useCallback(() => {
    void charactersApi.refresh();
    void worldApi.refresh();
    void foreshadowsApi.refresh();
  }, [charactersApi.refresh, worldApi.refresh, foreshadowsApi.refresh]);

  // 浮窗或资料助手保存设定后，同步刷新左栏列表
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
  /** 三份设定数据是否都已加载结束（事件到达时用来决定「缓存等重试」还是「放弃」） */
  const settledRef = React.useRef(false);
  settledRef.current = !loading;
  const total = characters.length + world.length + foreshadows.length;
  const matched = filtered.characters.length + filtered.world.length + filtered.foreshadows.length;

  const groups: { key: string; title: string; icon: React.ReactNode; entries: CodexEntry[]; total: number }[] = [
    { key: "characters", title: "角色", icon: <User className="size-3.5" />, entries: filtered.characters, total: characters.length },
    { key: "world", title: "世界观", icon: <MapPin className="size-3.5" />, entries: filtered.world, total: world.length },
    { key: "foreshadows", title: "伏笔", icon: <ScrollText className="size-3.5" />, entries: filtered.foreshadows, total: foreshadows.length },
  ];

  const openCreate = (kind: CodexEntry["kind"]) => {
    setEditing(null);
    setCreatingWorld(kind === "world");
    setCreatingCharacter(kind === "character");
    setCreatingForeshadow(kind === "foreshadow");
  };

  const closeEditor = () => {
    setEditing(null);
    setCreatingWorld(false);
    setCreatingCharacter(false);
    setCreatingForeshadow(false);
  };

  const handleSaved = (entry: CodexEntry) => {
    refreshAll();
    setCreatingWorld(false);
    setCreatingCharacter(false);
    setCreatingForeshadow(false);
    setEditing(entry);
  };

  const handleDeleted = () => {
    refreshAll();
    setEditing(null);
    setCreatingWorld(false);
    setCreatingCharacter(false);
    setCreatingForeshadow(false);
  };

  const findEntry = React.useCallback(
    (kind: string | undefined, id: string): CodexEntry | null => {
      if (kind === "character") {
        const found = characters.find((item) => item.id === id);
        return found ? { kind: "character", data: found } : null;
      }
      if (kind === "world") {
        const found = world.find((item) => item.id === id);
        return found ? { kind: "world", data: found } : null;
      }
      if (kind === "foreshadow") {
        const found = foreshadows.find((item) => item.id === id);
        return found ? { kind: "foreshadow", data: found } : null;
      }
      return null;
    },
    [characters, world, foreshadows],
  );

  const openEntry = React.useCallback((entry: CodexEntry) => {
    setEditing(entry);
    setCreatingWorld(false);
    setCreatingCharacter(false);
    setCreatingForeshadow(false);
  }, []);

  /** 数据就绪时打开卡片；找不到返回 false（可能只是还没加载完） */
  const tryOpenCard = React.useCallback(
    (detail: { kind?: string; id?: string }): boolean => {
      if (!detail?.id) return false;
      const entry = findEntry(detail.kind, detail.id);
      if (!entry) return false;
      openEntry(entry);
      return true;
    },
    [findEntry, openEntry],
  );

  // CodexPanel 可能晚于事件挂载（切页签才预热）：挂载时取一次命令面板留下的暂存
  React.useEffect(() => {
    const pending = takePendingCodexCard();
    if (!pending || pending.novelId !== novelId) return;
    pendingCardRef.current = pending;
    if (tryOpenCard(pending)) pendingCardRef.current = null;
    // 只取一次；数据未就绪时的重试交给下面的 effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 命令面板（⌘K）等外部入口：直接打开某张卡；数据没加载完时缓存，加载完再开 */
  React.useEffect(() => {
    const openCard = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: string; id?: string }>).detail;
      // 事件本身已送达，清掉派发前的暂存，避免之后再重复打开
      takePendingCodexCard();
      if (!detail?.id) return;
      if (detail.kind !== "character" && detail.kind !== "world" && detail.kind !== "foreshadow") return;
      if (tryOpenCard(detail)) {
        pendingCardRef.current = null;
        return;
      }
      // 数据还没加载完：先记下，等 useApi 返回后重试；数据已就绪仍找不到就放弃（卡片可能已删除）
      pendingCardRef.current = settledRef.current ? null : { novelId, kind: detail.kind, id: detail.id };
    };
    window.addEventListener("yantian:open-card", openCard);
    return () => window.removeEventListener("yantian:open-card", openCard);
  }, [novelId, tryOpenCard]);

  // 数据加载 / refresh 完成后，补开之前缓存的卡片
  React.useEffect(() => {
    const pending = pendingCardRef.current;
    if (!pending) return;
    if (tryOpenCard(pending)) {
      pendingCardRef.current = null;
      return;
    }
    if (settledRef.current) pendingCardRef.current = null;
  }, [tryOpenCard, charactersApi.loading, worldApi.loading, foreshadowsApi.loading]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      {/* 头部：条数统计 + 新建入口 + 搜索 */}
      <div className="shrink-0 space-y-2 border-b border-line px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] tabular-nums text-ink-3">
            {keyword ? `${matched} / ${total} 条` : `${total} 条设定`}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11.5px]"
              onClick={() => openCreate("character")}
            >
              新角色
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[11.5px]"
              onClick={() => openCreate("foreshadow")}
            >
              新伏笔
            </Button>
            <button
              type="button"
              onClick={() => openCreate("world")}
              className="inline-flex items-center gap-1 rounded-sm text-[11.5px] text-ink-2 transition-colors hover:text-ink"
            >
              <Plus className="size-3" aria-hidden />
              新建设定
            </button>
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
              icon={<ScrollText className="size-5" />}
              title="还没有设定"
              description="点「新建设定」，在正文上打开一张卡。整段材料用「交给助手」交给右侧输入框。"
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
                  <div className="space-y-2">
                    {(group.key === "world" && !keyword
                      ? worldRows(group.entries.map((entry) => entry.data as WorldSetting)).map(({ setting, depth }) => ({
                          entry: { kind: "world" as const, data: setting },
                          depth,
                        }))
                      : group.entries.map((entry) => ({ entry, depth: 0 }))
                    ).map(({ entry, depth }) => {
                      return (
                        <button
                          key={`${entry.kind}:${entry.data.id}`}
                          type="button"
                          onClick={() => setEditing(entry)}
                          className="group block w-full min-w-0 rounded-xl border border-line/65 bg-surface/60 px-3 py-3.5 text-left transition-colors duration-150 hover:border-jade/30 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 motion-reduce:transition-none"
                          style={{ marginLeft: depth * 10, width: `calc(100% - ${depth * 10}px)` }}
                        >
                          <MaterialPreview kind={entry.kind} fields={entry.data as unknown as Record<string, unknown>}/>
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
        open={creatingCharacter || editing?.kind === "character"}
        novelId={novelId}
        character={editing?.kind === "character" ? editing.data : null}
        characters={characters}
        chapters={editorChapters}
        onClose={closeEditor}
        onSaved={(saved) => handleSaved({ kind: "character", data: saved })}
        onDeleted={handleDeleted}
        presentation="float"
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
        presentation="float"
      />
      <ForeshadowEditor
        open={creatingForeshadow || editing?.kind === "foreshadow"}
        novelId={novelId}
        foreshadow={editing?.kind === "foreshadow" ? editing.data : null}
        chapters={editorChapters}
        onClose={closeEditor}
        onSaved={(saved) => handleSaved({ kind: "foreshadow", data: saved })}
        onDeleted={handleDeleted}
        presentation="float"
      />
    </div>
  );
}
