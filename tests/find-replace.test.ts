import { describe, expect, it } from "vitest";
import {
  clampMatchIndex,
  collectTextSegments,
  findMatches,
  sortMatchesForReplacement,
  stepMatchIndex,
  type TraversableDocument,
  type TraversableNode,
} from "@/lib/editor/find";

/**
 * 假文档：按 ProseMirror 语义给每个文本块一个位置。
 * 第一块从 0 开始，每块占 text.length + 2（模拟块级开闭标记），内容从 pos + 1 开始。
 */
function fakeDocument(texts: string[]): TraversableDocument {
  return {
    descendants(callback: (node: TraversableNode, pos: number) => void | boolean) {
      let pos = 0;
      for (const text of texts) {
        callback({ isTextblock: true, textContent: text }, pos);
        pos += text.length + 2;
      }
    },
  };
}

describe("collectTextSegments", () => {
  it("把文本块映射成 { from, to, text }，内容从 pos + 1 开始", () => {
    const segments = collectTextSegments(fakeDocument(["你好，世界", "第二段"]));
    expect(segments).toEqual([
      { from: 1, to: 6, text: "你好，世界" },
      { from: 8, to: 11, text: "第二段" },
    ]);
  });

  it("跳过空文本块，但保留后续块的位置", () => {
    const segments = collectTextSegments(fakeDocument(["", "风起"]));
    expect(segments).toEqual([{ from: 3, to: 5, text: "风起" }]);
  });

  it("忽略非文本块（图片 / 分隔线等）", () => {
    const doc: TraversableDocument = {
      descendants(callback) {
        callback({ isTextblock: true, textContent: "第一段" } as TraversableNode, 0);
        callback({ isTextblock: false, textContent: "" } as TraversableNode, 4);
        callback({ isTextblock: true, textContent: "第三段" } as TraversableNode, 5);
      },
    };
    expect(collectTextSegments(doc).map((segment) => segment.text)).toEqual(["第一段", "第三段"]);
  });
});

describe("findMatches", () => {
  it("在一段里给出多处的文档位置", () => {
    const segments = collectTextSegments(fakeDocument(["潮信要送出，潮信要回来。"]));
    const matches = findMatches(segments, "潮信");
    expect(matches.map((match) => [match.from, match.to])).toEqual([
      [1, 3],
      [7, 9],
    ]);
    expect(matches[0]).toMatchObject({ segmentIndex: 0, index: 0, text: "潮信" });
    expect(matches[1]).toMatchObject({ segmentIndex: 0, index: 6 });
  });

  it("中文按 UTF-16 长度映射位置（与 ProseMirror position 一致）", () => {
    const segments = collectTextSegments(fakeDocument(["第一章：风起"]));
    const matches = findMatches(segments, "风起");
    expect(matches).toHaveLength(1);
    expect(matches[0].from).toBe(1 + 4);
    expect(matches[0].to).toBe(1 + 6);
  });

  it("emoji（代理对占 2 个 UTF-16 码元）之后的位置同样正确", () => {
    const segments = collectTextSegments(fakeDocument(["😀笑"]));
    const matches = findMatches(segments, "笑");
    expect(matches[0].from).toBe(1 + 2);
    expect(matches[0].to).toBe(1 + 3);
  });

  it("不跨段匹配：跨段查询返回空且不抛错", () => {
    const segments = collectTextSegments(fakeDocument(["你好", "世界"]));
    expect(findMatches(segments, "好世")).toEqual([]);
  });

  it("区分大小写", () => {
    const segments = collectTextSegments(fakeDocument(["Hello hello HELLO"]));
    expect(findMatches(segments, "hello")).toHaveLength(1);
    expect(findMatches(segments, "Hello")).toHaveLength(1);
    expect(findMatches(segments, "HELLO")).toHaveLength(1);
    expect(findMatches(segments, "hEllo")).toEqual([]);
  });

  it("空查询返回空数组", () => {
    const segments = collectTextSegments(fakeDocument(["随便什么"]));
    expect(findMatches(segments, "")).toEqual([]);
  });

  it("连续命中分别计数，重叠命中不重复计数", () => {
    const segments = collectTextSegments(fakeDocument(["abab", "aaa"]));
    const matches = findMatches(segments, "ab");
    expect(matches.map((match) => match.from)).toEqual([1, 3]);

    // "aaa" 里查 "aa"：只算一处（非重叠语义），保证「全部替换」区间不互相破坏
    const overlapSegments = collectTextSegments(fakeDocument(["aaa"]));
    expect(findMatches(overlapSegments, "aa").map((match) => match.from)).toEqual([1]);
  });

  it("无命中返回空数组", () => {
    const segments = collectTextSegments(fakeDocument(["风起", "云涌"]));
    expect(findMatches(segments, "潮信")).toEqual([]);
    expect(findMatches([], "潮信")).toEqual([]);
  });
});

describe("stepMatchIndex / clampMatchIndex", () => {
  it("在命中之间循环前进与后退", () => {
    expect(stepMatchIndex(0, 3, 1)).toBe(1);
    expect(stepMatchIndex(2, 3, 1)).toBe(0);
    expect(stepMatchIndex(0, 3, -1)).toBe(2);
    expect(stepMatchIndex(1, 3, -1)).toBe(0);
  });

  it("无命中时恒为 0", () => {
    expect(stepMatchIndex(0, 0, 1)).toBe(0);
    expect(stepMatchIndex(5, 0, -1)).toBe(0);
  });

  it("越界下标回落到首 / 尾", () => {
    expect(stepMatchIndex(9, 3, 1)).toBe(0);
    expect(stepMatchIndex(9, 3, -1)).toBe(2);
    expect(clampMatchIndex(-2, 3)).toBe(0);
    expect(clampMatchIndex(3, 3)).toBe(2);
    expect(clampMatchIndex(2, 3)).toBe(2);
    expect(clampMatchIndex(2, 0)).toBe(0);
  });
});

describe("sortMatchesForReplacement", () => {
  it("按文档位置从后往前排序，供全部替换安全执行", () => {
    const matches = findMatches(collectTextSegments(fakeDocument(["a b a"])), "a");
    expect(matches.map((match) => match.from)).toEqual([1, 5]);
    expect(sortMatchesForReplacement(matches).map((match) => match.from)).toEqual([5, 1]);
  });
});
