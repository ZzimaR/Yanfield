"use client";

import * as React from "react";
import { BookOpen, Library, ListTree, ScrollText } from "lucide-react";
import { Tabs, type TabItem } from "@/components/ui/kit";
import type { EditorTab, NovelTree, TreeActions } from "@/lib/editor/types";
import { ChapterTree } from "./ChapterTree";
import { CodexPanel } from "./CodexPanel";
import { OutlinePanel } from "./OutlinePanel";
import { ResearchPanel } from "./ResearchPanel";

/** 左栏第四页「设定」：角色 / 世界观 / 伏笔速查 */
export type EditorLeftTab = EditorTab | "codex";

interface LeftPanelProps {
  novelId: string;
  tree: NovelTree | null;
  loading: boolean;
  currentChapterId: string | null;
  currentVolumeId: string | null;
  tab: EditorLeftTab;
  onTabChange: (tab: EditorLeftTab) => void;
  actions: TreeActions;
  onSelectChapter: (chapterId: string) => void;
}

/** 编辑器左栏：目录 / 大纲速览 / 资料 / 设定 四个标签页 */
export function LeftPanel({
  novelId,
  tree,
  loading,
  currentChapterId,
  currentVolumeId,
  tab,
  onTabChange,
  actions,
  onSelectChapter,
}: LeftPanelProps) {
  const chapterCount =
    (tree?.volumes.reduce((sum, volume) => sum + volume.chapters.length, 0) ?? 0) +
    (tree?.looseChapters.length ?? 0);

  const tabs: TabItem[] = [
    { value: "toc", label: "目录", icon: <ListTree className="size-3.5" />, count: chapterCount || undefined },
    { value: "outline", label: "大纲", icon: <ScrollText className="size-3.5" /> },
    { value: "research", label: "资料", icon: <Library className="size-3.5" /> },
    { value: "codex", label: "设定", icon: <BookOpen className="size-3.5" /> },
  ];

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-surface">
      <Tabs
        className="shrink-0 gap-0 px-1 [&>button]:shrink-0 [&>button]:whitespace-nowrap [&>button]:gap-1 [&>button]:px-2 [&>button]:text-[12.5px] [&>button>svg]:hidden"
        tabs={tabs}
        value={tab}
        onChange={(value) => onTabChange(value as EditorLeftTab)}
      />
      <div className="min-h-0 w-full min-w-0 flex-1 overflow-hidden">
        {tab === "toc" ? (
          <ChapterTree
            novelId={novelId}
            tree={tree}
            loading={loading}
            currentChapterId={currentChapterId}
            currentVolumeId={currentVolumeId}
            actions={actions}
            onSelectChapter={onSelectChapter}
          />
        ) : null}
        {tab === "outline" ? (
          <div className="scroll-thin h-full overflow-y-auto">
            <OutlinePanel novelId={novelId} chapterId={currentChapterId} volumeId={currentVolumeId} />
          </div>
        ) : null}
        {tab === "research" ? (
          <div className="scroll-thin h-full overflow-y-auto">
            <ResearchPanel novelId={novelId} chapterId={currentChapterId} />
          </div>
        ) : null}
        {tab === "codex" ? <CodexPanel novelId={novelId} /> : null}
      </div>
    </div>
  );
}
