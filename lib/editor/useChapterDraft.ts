"use client";

import * as React from "react";
import type { Chapter, ChapterStatus } from "@/lib/types";
import type { ChapterPatch, SaveState } from "./types";

/** 当前章节的本地草稿（编辑器的唯一事实来源） */
export interface ChapterDraft {
  chapterId: string;
  title: string;
  content: string;
  summary: string;
  status: ChapterStatus;
  wordCount: number;
}

interface UseChapterDraftOptions {
  /** 当前选中章节；null 表示没有打开任何章节 */
  chapter: Chapter | null;
  /** 停止输入后多久自动保存（取 AppSettings.autoSaveDelayMs，默认 1200） */
  delayMs?: number;
  /** 是否自动保存（AppSettings.autoSave） */
  autoSave?: boolean;
  /** 真正落库的 PATCH，由调用方接 /api/chapters/[id] */
  onPersist: (chapterId: string, patch: ChapterPatch) => Promise<void>;
  /** 保存失败提示 */
  onError?: (message: string) => void;
}

export interface ChapterDraftApi {
  draft: ChapterDraft | null;
  saveState: SaveState;
  lastSavedAt: string | null;
  /** 是否存在尚未落库的改动（用于离开页面提示） */
  hasUnsaved: boolean;
  setTitle: (title: string) => void;
  setContent: (html: string, wordCount: number) => void;
  setSummary: (summary: string) => void;
  setStatus: (status: ChapterStatus) => void;
  /** 立即保存（Ctrl/Cmd+S、切章前、离开页面时） */
  flush: () => Promise<void>;
  /** 取消待执行的自动保存（卸载时用） */
  cancel: () => void;
  adoptSaved: (chapter: Chapter) => void;
}

/**
 * 章节草稿与自动保存。
 * - 停输入 delayMs 后自动 PATCH；
 * - 保存期间继续输入不会丢：pending 标记保留，保存成功后再排一次；
 * - 切章时由调用方先 flush，本 hook 也会在 chapterId 变化时清空状态。
 */
export function useChapterDraft({
  chapter,
  delayMs = 1200,
  autoSave = true,
  onPersist,
  onError,
}: UseChapterDraftOptions): ChapterDraftApi {
  const [draft, setDraft] = React.useState<ChapterDraft | null>(null);
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [hasUnsaved, setHasUnsaved] = React.useState(false);

  const draftRef = React.useRef<ChapterDraft | null>(null);
  const pendingRef = React.useRef(false);
  const savingRef = React.useRef(false);
  const inFlightRef = React.useRef<Promise<void> | null>(null);
  const timerRef = React.useRef<number | null>(null);
  const scheduleRef = React.useRef<() => void>(() => {});
  const chapterRef = React.useRef<Chapter | null>(chapter);

  const onPersistRef = React.useRef(onPersist);
  const onErrorRef = React.useRef(onError);
  React.useEffect(() => {
    onPersistRef.current = onPersist;
    onErrorRef.current = onError;
    chapterRef.current = chapter;
  });

  const clearTimer = React.useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** 真正执行保存：调用方保证同一时间只有一次 in-flight 请求 */
  const flush = React.useCallback(async (): Promise<void> => {
    clearTimer();
    if (inFlightRef.current) await inFlightRef.current;
    while (pendingRef.current) {
      const current = draftRef.current;
      if (!current) return;
      pendingRef.current = false;
      savingRef.current = true;
      setSaveState("saving");
      const operation = onPersistRef.current(current.chapterId, {
        title: current.title, content: current.content, summary: current.summary,
        status: current.status, wordCount: current.wordCount,
      });
      inFlightRef.current = operation;
      try {
        await operation;
        if (draftRef.current?.chapterId === current.chapterId) {
          setLastSavedAt(new Date().toISOString());
          setSaveState(pendingRef.current ? "dirty" : "saved");
          setHasUnsaved(pendingRef.current);
        }
      } catch (err) {
        pendingRef.current = true;
        setSaveState("error"); setHasUnsaved(true);
        onErrorRef.current?.(err instanceof Error ? err.message : "保存失败");
        throw err;
      } finally {
        savingRef.current = false;
        if (inFlightRef.current === operation) inFlightRef.current = null;
      }
    }
  }, [clearTimer]);

  /** 排自动保存定时器 */
  const schedule = React.useCallback((): void => {
    clearTimer();
    if (!autoSave) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void flush().catch(() => {});
    }, delayMs);
  }, [autoSave, delayMs, clearTimer, flush]);

  React.useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  /** 切章：重置草稿与状态（先清 timer，调用方负责 flush 旧章） */
  const chapterId = chapter?.id ?? null;
  React.useEffect(() => {
    clearTimer();
    pendingRef.current = false;
    savingRef.current = false;
    const next = chapterRef.current;
    if (!next) {
      draftRef.current = null;
      setDraft(null);
      setSaveState("idle");
      setLastSavedAt(null);
      setHasUnsaved(false);
      return;
    }
    const fresh: ChapterDraft = {
      chapterId: next.id,
      title: next.title,
      content: next.content,
      summary: next.summary,
      status: next.status,
      wordCount: next.wordCount,
    };
    draftRef.current = fresh;
    setDraft(fresh);
    setSaveState("idle");
    setLastSavedAt(next.updatedAt);
    setHasUnsaved(false);
    // 只按 id 重置：同章内容更新（保存回写、AI 应用）不能重置草稿
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  /** 统一修改草稿：标脏 + 重排自动保存 */
  const patchDraft = React.useCallback(
    (fields: Partial<Omit<ChapterDraft, "chapterId">>): void => {
      const previous = draftRef.current;
      if (!previous) return;
      const next: ChapterDraft = { ...previous, ...fields };
      draftRef.current = next;
      setDraft(next);
      pendingRef.current = true;
      setHasUnsaved(true);
      setSaveState("dirty");
      schedule();
    },
    [schedule],
  );

  const setTitle = React.useCallback((title: string) => patchDraft({ title }), [patchDraft]);
  const setContent = React.useCallback(
    (content: string, wordCount: number) => patchDraft({ content, wordCount }),
    [patchDraft],
  );
  const setSummary = React.useCallback((summary: string) => patchDraft({ summary }), [patchDraft]);
  const setStatus = React.useCallback(
    (status: ChapterStatus) => patchDraft({ status }),
    [patchDraft],
  );

  React.useEffect(() => () => clearTimer(), [clearTimer]);

  const adoptSaved = React.useCallback((saved: Chapter) => {
    if (draftRef.current?.chapterId !== saved.id) return;
    clearTimer();
    const next: ChapterDraft = {chapterId:saved.id,title:saved.title,content:saved.content,summary:saved.summary,status:saved.status,wordCount:saved.wordCount};
    draftRef.current=next; pendingRef.current=false;
    setDraft(next); setHasUnsaved(false); setSaveState("saved"); setLastSavedAt(saved.updatedAt);
  },[clearTimer]);

  return {
    draft,
    saveState,
    lastSavedAt,
    hasUnsaved,
    setTitle,
    setContent,
    setSummary,
    setStatus,
    flush,
    cancel: clearTimer,
    adoptSaved,
  };
}
