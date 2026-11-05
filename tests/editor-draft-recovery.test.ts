import { describe, expect, it } from "vitest";
import {
  readRecoveryDraft,
  removeMatchingRecoveryDraft,
  sameChapterDraft,
  writeRecoveryDraft,
} from "@/lib/editor/draft-recovery";
import type { ChapterDraft } from "@/lib/editor/useChapterDraft";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

const draft: ChapterDraft = {
  chapterId: "chapter-1",
  title: "第一章",
  content: "<p>未保存的正文</p>",
  summary: "",
  status: "draft",
  wordCount: 6,
};

describe("标签页临时草稿", () => {
  it("按章节保存和读取草稿", () => {
    const storage = memoryStorage();
    writeRecoveryDraft(storage, draft);
    expect(readRecoveryDraft(storage, draft.chapterId)).toEqual(draft);
    expect(readRecoveryDraft(storage, "chapter-2")).toBeNull();
    expect(sameChapterDraft(draft, { ...draft })).toBe(true);
  });

  it("旧保存完成时不会删除更新的恢复草稿", () => {
    const storage = memoryStorage();
    const newer = { ...draft, content: "<p>更新后的正文</p>" };
    writeRecoveryDraft(storage, newer);
    removeMatchingRecoveryDraft(storage, draft);
    expect(readRecoveryDraft(storage, draft.chapterId)).toEqual(newer);
    removeMatchingRecoveryDraft(storage, newer);
    expect(readRecoveryDraft(storage, draft.chapterId)).toBeNull();
  });

  it("损坏的草稿或不可用的存储明确报错", () => {
    const storage = memoryStorage();
    storage.setItem("yanfield:editor:recovery:chapter-1", JSON.stringify({ version: 1, draft: {} }));
    expect(() => readRecoveryDraft(storage, draft.chapterId)).toThrow("临时草稿格式无效");
    expect(() => writeRecoveryDraft({
      ...storage,
      setItem: () => { throw new Error("存储空间不足"); },
    }, draft)).toThrow("存储空间不足");
  });
});
