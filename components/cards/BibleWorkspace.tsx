"use client";

/**
 * 设定库工作台：角色 / 世界观 / 伏笔 三个视图
 * 数据：GET /api/characters|/api/world|/api/foreshadows?novelId=，编辑走各自 Sheet（内部 PATCH/POST/DELETE）
 * 刷新：useApi + useDataChanged（characters / world / foreshadows 三个 topic）
 */
import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  Globe2,
  Link2,
  Plus,
  Search,
  Users,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge, Button, EmptyState, Input, Segmented, Select, Tabs } from "@/components/ui/kit";
import { useApi, useDataChanged } from "@/lib/client/api";
import type { Chapter, Character, Foreshadow, ForeshadowStatus, Volume, WorldSetting } from "@/lib/types";
import { CHARACTER_ROLE_LABEL, FORESHADOW_STATUS_LABEL } from "@/lib/types";
import { cn } from "@/lib/ui/cn";
import {
  InlineError,
  PageHeader,
  PanelSkeleton,
  StatCard,
  reindexChaptersByVolume,
  useErrorToast,
} from "@/components/outline/form-kit";
import { CharacterCard } from "./CharacterCard";
import { CharacterEditor } from "./CharacterEditor";
import { ForeshadowCard } from "./ForeshadowCard";
import { ForeshadowEditor } from "./ForeshadowEditor";
import { WorldCard } from "./WorldCard";
import { WorldEditor } from "./WorldEditor";

export type BibleTab = "characters" | "world" | "foreshadows";

interface WorldNode {
  setting: WorldSetting;
  children: WorldNode[];
}

function buildWorldTree(items: WorldSetting[]): WorldNode[] {
  const nodes = new Map<string, WorldNode>();
  for (const setting of items) nodes.set(setting.id, { setting, children: [] });
  const roots: WorldNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.setting.parentId ? nodes.get(node.setting.parentId) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  const sortNodes = (list: WorldNode[]) => {
    list.sort((a, b) => a.setting.orderIndex - b.setting.orderIndex || a.setting.title.localeCompare(b.setting.title, "zh-CN"));
    for (const node of list) sortNodes(node.children);
  };
  sortNodes(roots);
  return roots;
}

function filterWorldTree(nodes: WorldNode[], query: string): WorldNode[] {
  if (!query) return nodes;
  const matched: WorldNode[] = [];
  for (const node of nodes) {
    const children = filterWorldTree(node.children, query);
    const haystack = `${node.setting.title} ${node.setting.summary} ${node.setting.content} ${node.setting.tags.join(" ")}`;
    if (children.length > 0 || haystack.toLowerCase().includes(query)) {
      matched.push({ setting: node.setting, children });
    }
  }
  return matched;
}

const FORESHADOW_FILTERS: { value: "all" | ForeshadowStatus; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "planted", label: "已埋设" },
  { value: "advanced", label: "推进中" },
  { value: "paid", label: "已回收" },
  { value: "dropped", label: "已放弃" },
];

export function BibleWorkspace({ novelId, initialTab }: { novelId: string; initialTab?: string }) {
  const initial: BibleTab = initialTab === "world" || initialTab === "foreshadows" ? initialTab : "characters";
  const [tab, setTab] = React.useState<BibleTab>(initial);
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | ForeshadowStatus>("all");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());

  const [characterSheet, setCharacterSheet] = React.useState<{ open: boolean; character: Character | null }>({
    open: false,
    character: null,
  });
  const [worldSheet, setWorldSheet] = React.useState<{ open: boolean; setting: WorldSetting | null }>({
    open: false,
    setting: null,
  });
  const [foreshadowSheet, setForeshadowSheet] = React.useState<{ open: boolean; foreshadow: Foreshadow | null }>({
    open: false,
    foreshadow: null,
  });

  const queryString = `?novelId=${encodeURIComponent(novelId)}`;
  const charactersApi = useApi<{ items: Character[] }>(`/api/characters${queryString}`);
  const worldApi = useApi<{ items: WorldSetting[] }>(`/api/world${queryString}`);
  const foreshadowsApi = useApi<{ items: Foreshadow[] }>(`/api/foreshadows${queryString}`);
  const chaptersApi = useApi<{ items: Chapter[] }>(`/api/chapters${queryString}`);
  const volumesApi = useApi<{ items: Volume[] }>(`/api/volumes${queryString}`);

  useErrorToast(charactersApi.error, "角色加载失败");
  useErrorToast(worldApi.error, "世界观加载失败");
  useErrorToast(foreshadowsApi.error, "伏笔加载失败");
  useErrorToast(chaptersApi.error, "章节加载失败");

  const refreshAll = React.useCallback(() => {
    void charactersApi.refresh();
    void worldApi.refresh();
    void foreshadowsApi.refresh();
    void volumesApi.refresh();
  }, [charactersApi, worldApi, foreshadowsApi, volumesApi]);

  useDataChanged(refreshAll);

  const volumes = React.useMemo(() => volumesApi.data?.items ?? [], [volumesApi.data]);
  const characters = React.useMemo(() => charactersApi.data?.items ?? [], [charactersApi.data]);
  const settings = React.useMemo(() => worldApi.data?.items ?? [], [worldApi.data]);
  const foreshadows = React.useMemo(() => foreshadowsApi.data?.items ?? [], [foreshadowsApi.data]);
  // 全书统一章号：chapter.orderIndex 只在卷内唯一，先按分卷重排再用于下拉与徽标
  const chapters = React.useMemo(
    () => reindexChaptersByVolume(chaptersApi.data?.items ?? [], volumes),
    [chaptersApi.data, volumes],
  );
  const chapterMap = React.useMemo(() => new Map(chapters.map((chapter) => [chapter.id, chapter])), [chapters]);

  const searching = query.trim().toLowerCase();
  const filteredCharacters = React.useMemo(() => {
    return characters.filter((character) => {
      if (roleFilter !== "all" && character.role !== roleFilter) return false;
      if (!searching) return true;
      const haystack = [
        character.name,
        character.identity,
        character.personality,
        character.goals,
        character.currentState,
        ...character.aliases,
        ...character.tags,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searching);
    });
  }, [characters, roleFilter, searching]);

  const worldTree = React.useMemo(() => buildWorldTree(settings), [settings]);
  const filteredWorldTree = React.useMemo(() => filterWorldTree(worldTree, searching), [worldTree, searching]);
  const worldParentTitle = React.useMemo(() => {
    const map = new Map(settings.map((setting) => [setting.id, setting.title]));
    return (parentId: string | null) => (parentId ? map.get(parentId) : undefined);
  }, [settings]);

  const filteredForeshadows = React.useMemo(() => {
    return foreshadows.filter((foreshadow) => {
      if (statusFilter !== "all" && foreshadow.status !== statusFilter) return false;
      if (!searching) return true;
      return [foreshadow.title, foreshadow.description, foreshadow.notes].join(" ").toLowerCase().includes(searching);
    });
  }, [foreshadows, statusFilter, searching]);

  const unresolvedCount = foreshadows.filter((item) => item.status === "planted" || item.status === "advanced").length;

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const chapterOptions = React.useMemo(
    () => chapters.map((chapter) => ({ id: chapter.id, orderIndex: chapter.orderIndex, title: chapter.title })),
    [chapters],
  );

  const renderWorldNodes = (nodes: WorldNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      const nodeCollapsed = collapsed.has(node.setting.id);
      return (
        <div key={node.setting.id} className={cn("space-y-2", depth > 0 ? "border-l border-line pl-3" : null)}>
          <div className="flex items-start gap-1">
            {node.children.length > 0 ? (
              <button
                type="button"
                onClick={() => toggleCollapse(node.setting.id)}
                className="mt-3 flex size-5 shrink-0 items-center justify-center rounded-xs text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink-2"
                aria-label={nodeCollapsed ? "展开子设定" : "折叠子设定"}
              >
                {nodeCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
            ) : (
              <span className="mt-3 size-5 shrink-0" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <WorldCard
                setting={node.setting}
                depth={depth}
                parentTitle={worldParentTitle(node.setting.parentId)}
                childCount={node.children.length}
                onClick={() => setWorldSheet({ open: true, setting: node.setting })}
              />
            </div>
          </div>
          {node.children.length > 0 && !nodeCollapsed && node.children.length > 0 ? (
            <div className="space-y-2">{renderWorldNodes(node.children, depth + 1)}</div>
          ) : null}
        </div>
      );
    });

  const tabContent = () => {
    if (tab === "characters") {
      if (charactersApi.loading && !charactersApi.data) return <PanelSkeleton rows={5} />;
      if (characters.length === 0) {
        return (
          <EmptyState
            icon={<Users className="size-5" />}
            title="还没有角色卡"
            description="先建主角与关键对手，AI 写起来才会有稳定的动机与语气。"
            action={
              <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => setCharacterSheet({ open: true, character: null })}>
                新建角色
              </Button>
            }
          />
        );
      }
      return (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="w-36">
              <Select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                options={[{ value: "all", label: "全部定位" }, ...Object.entries(CHARACTER_ROLE_LABEL).map(([value, label]) => ({ value, label }))]}
              />
            </div>
            <span className="text-[11.5px] text-ink-3">
              共 {characters.length} 个角色{searching || roleFilter !== "all" ? ` · 筛选出 ${filteredCharacters.length} 个` : ""}
            </span>
          </div>
          {filteredCharacters.length === 0 ? (
            <p className="rounded-md border border-line bg-surface-2 px-4 py-6 text-center text-[12.5px] text-ink-3">
              没有匹配「{query}」的角色，换个关键词试试。
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {filteredCharacters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  onClick={() => setCharacterSheet({ open: true, character })}
                />
              ))}
            </div>
          )}
        </>
      );
    }

    if (tab === "world") {
      if (worldApi.loading && !worldApi.data) return <PanelSkeleton rows={5} />;
      if (settings.length === 0) {
        return (
          <EmptyState
            icon={<Globe2 className="size-5" />}
            title="还没有世界观设定"
            description="规则、地理、势力、历史都可以登记；写清限制与代价，AI 才不会越写越飘。"
            action={
              <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => setWorldSheet({ open: true, setting: null })}>
                新建设定
              </Button>
            }
          />
        );
      }
      return (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-3">
            <span>共 {settings.length} 条设定</span>
            {searching ? <span>· 筛选出 {filteredWorldTree.length} 个顶层节点</span> : null}
          </div>
          {filteredWorldTree.length === 0 ? (
            <p className="rounded-md border border-line bg-surface-2 px-4 py-6 text-center text-[12.5px] text-ink-3">
              没有匹配「{query}」的设定，换个关键词试试。
            </p>
          ) : (
            <div className="space-y-2.5">{renderWorldNodes(filteredWorldTree)}</div>
          )}
        </>
      );
    }

    if (foreshadowsApi.loading && !foreshadowsApi.data) return <PanelSkeleton rows={5} />;
    if (foreshadows.length === 0) {
      return (
        <EmptyState
          icon={<Link2 className="size-5" />}
          title="还没有伏笔"
          description="把埋下的钩子登记下来，回收时才有账可对。"
          action={
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="size-3.5" />}
              onClick={() => setForeshadowSheet({ open: true, foreshadow: null })}
            >
              新建伏笔
            </Button>
          }
        />
      );
    }
    return (
      <>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Segmented
            options={FORESHADOW_FILTERS.map((item) => ({
              ...item,
              label: item.value === "all" ? `${item.label} ${foreshadows.length}` : `${item.label} ${foreshadows.filter((f) => f.status === item.value).length}`,
            }))}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as "all" | ForeshadowStatus)}
            size="sm"
          />
          <span className="text-[11.5px] text-ink-3">{filteredForeshadows.length} 条</span>
        </div>
        {filteredForeshadows.length === 0 ? (
          <p className="rounded-md border border-line bg-surface-2 px-4 py-6 text-center text-[12.5px] text-ink-3">
            当前筛选下没有可显示的内容。
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredForeshadows.map((foreshadow) => (
              <ForeshadowCard
                key={foreshadow.id}
                foreshadow={foreshadow}
                plantedChapter={foreshadow.plantedChapterId ? chapterMap.get(foreshadow.plantedChapterId) : undefined}
                payoffChapter={foreshadow.payoffChapterId ? chapterMap.get(foreshadow.payoffChapterId) : undefined}
                onClick={() => setForeshadowSheet({ open: true, foreshadow })}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  const newButton = () => {
    if (tab === "characters") {
      return (
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="size-3.5" />}
          onClick={() => setCharacterSheet({ open: true, character: null })}
        >
          新建角色
        </Button>
      );
    }
    if (tab === "world") {
      return (
        <Button variant="primary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => setWorldSheet({ open: true, setting: null })}>
          新建设定
        </Button>
      );
    }
    return (
      <Button
        variant="primary"
        size="sm"
        icon={<Plus className="size-3.5" />}
        onClick={() => setForeshadowSheet({ open: true, foreshadow: null })}
      >
        新建伏笔
      </Button>
    );
  };

  return (
    <AppShell novelId={novelId} active="bible">
      <div className="mx-auto w-full max-w-[1200px] px-4 py-5 md:px-6 md:py-6 [&_a:focus-visible]:outline-none [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-accent/60 [&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-accent/60">
        <PageHeader
          title="设定库"
          badge={<Badge tone="default">资料</Badge>}
          description="角色、世界观与伏笔在这里统一管理。写作时在写作台里打开，不必离开章节。"
          actions={newButton()}
        />

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="角色" value={characters.length} loading={charactersApi.loading && !charactersApi.data} />
          <StatCard label="世界观设定" value={settings.length} accent="jade" loading={worldApi.loading && !worldApi.data} />
          <StatCard label="伏笔" value={foreshadows.length} accent="gold" loading={foreshadowsApi.loading && !foreshadowsApi.data} />
          <StatCard label="未收伏笔" value={unresolvedCount} hint="已埋设 + 推进中" loading={foreshadowsApi.loading && !foreshadowsApi.data} />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
          <Tabs
            tabs={[
              { value: "characters", label: "角色", icon: <Users className="size-3.5" />, count: characters.length },
              { value: "world", label: "世界观", icon: <Globe2 className="size-3.5" />, count: settings.length },
              { value: "foreshadows", label: "伏笔", icon: <Link2 className="size-3.5" />, count: foreshadows.length },
            ]}
            value={tab}
            onChange={(value) => {
              setTab(value as BibleTab);
              setQuery("");
            }}
          />
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={tab === "characters" ? "搜索角色" : tab === "world" ? "搜索设定" : "搜索伏笔"}
              prefix={<Search className="size-3.5" />}
              className="w-52"
            />
          </div>
        </div>

        <div className="mt-4">
          {charactersApi.error && !charactersApi.data ? <InlineError message={charactersApi.error} onRetry={() => void charactersApi.refresh()} /> : null}
          {tabContent()}
        </div>
      </div>

      <CharacterEditor
        open={characterSheet.open}
        novelId={novelId}
        character={characterSheet.character}
        characters={characters}
        chapters={chapterOptions}
        onClose={() => setCharacterSheet({ open: false, character: null })}
        onSaved={() => void charactersApi.refresh()}
        onDeleted={() => void charactersApi.refresh()}
      />
      <WorldEditor
        open={worldSheet.open}
        novelId={novelId}
        setting={worldSheet.setting}
        settings={settings}
        chapters={chapterOptions}
        onClose={() => setWorldSheet({ open: false, setting: null })}
        onSaved={() => void worldApi.refresh()}
        onDeleted={() => void worldApi.refresh()}
      />
      <ForeshadowEditor
        open={foreshadowSheet.open}
        novelId={novelId}
        foreshadow={foreshadowSheet.foreshadow}
        chapters={chapterOptions}
        onClose={() => setForeshadowSheet({ open: false, foreshadow: null })}
        onSaved={() => void foreshadowsApi.refresh()}
        onDeleted={() => void foreshadowsApi.refresh()}
      />
    </AppShell>
  );
}
