"use client";

import * as React from "react";
import { Focus, Type } from "lucide-react";
import { IconButton, Kbd, Tooltip } from "@/components/ui/kit";
import { cn, formatWords } from "@/lib/ui/cn";
import type { SaveState, SelectionInfo } from "@/lib/editor/types";
import { SaveIndicator } from "./SaveIndicator";

/** 阅读时长：按 400 字/分钟向上取整 */
export function estimateReadingMinutes(wordCount: number): number {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 0;
  return Math.ceil(wordCount / 400);
}

interface EditorStatusBarProps {
  wordCount: number;
  /** 非空段落数（由 EditorCanvas 从文档里统计） */
  paragraphCount: number;
  selection: SelectionInfo;
  saveState: SaveState;
  lastSavedAt: string | null;
  /** 打字机滚动开关 */
  typewriter: boolean;
  /** 专注段落开关 */
  focusParagraph: boolean;
  onToggleTypewriter: () => void;
  onToggleFocusParagraph: () => void;
  className?: string;
}

/**
 * 正文底部状态条（非沉浸模式）：
 * 字数 · 段落数 · 阅读时长 · 选中字数 · 保存状态 · Ctrl+S 提示，
 * 右侧是「打字机滚动 / 专注段落」两个写作辅助开关（active 态）。
 */
export function EditorStatusBar({
  wordCount,
  paragraphCount,
  selection,
  saveState,
  lastSavedAt,
  typewriter,
  focusParagraph,
  onToggleTypewriter,
  onToggleFocusParagraph,
  className,
}: EditorStatusBarProps) {
  const minutes = estimateReadingMinutes(wordCount);

  return (
    <footer
      className={cn(
        "flex h-9 shrink-0 items-center gap-2 border-t border-line bg-surface/80 px-3 text-[11.5px] text-ink-3 sm:gap-3 sm:px-4",
        className,
      )}
      aria-label="写作状态栏"
    >
      <span className="tabular-nums">{formatWords(wordCount)} 字</span>
      <span className="h-3 w-px bg-line" aria-hidden />
      <span className="hidden tabular-nums sm:inline" title="按非空段落统计">
        段落 {paragraphCount}
      </span>
      <span className="hidden h-3 w-px bg-line sm:block" aria-hidden />
      <span className="hidden tabular-nums md:inline" title="按 400 字/分钟估算">
        阅读 {minutes} 分钟
      </span>
      <span className="hidden h-3 w-px bg-line md:block" aria-hidden />
      <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} />
      {selection.empty ? null : (
        <span className="tabular-nums text-accent">已选中 {selection.text.length} 字</span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <span className="mr-1 hidden items-center gap-1 text-ink-4 lg:flex" title="保存快捷键">
          <Kbd>Ctrl</Kbd>
          <span>+</span>
          <Kbd>S</Kbd>
        </span>
        <Tooltip label="打字机滚动（光标保持在屏幕约 38% 高度）">
          <IconButton label="打字机滚动" size="sm" active={typewriter} onClick={onToggleTypewriter}>
            <Type className="size-3.5" />
          </IconButton>
        </Tooltip>
        <Tooltip label="专注段落（淡化其他段落）">
          <IconButton label="专注段落" size="sm" active={focusParagraph} onClick={onToggleFocusParagraph}>
            <Focus className="size-3.5" />
          </IconButton>
        </Tooltip>
      </div>
    </footer>
  );
}
