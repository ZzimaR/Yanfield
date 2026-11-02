import { describe, expect, it } from "vitest";
import {
  applyBlockDiff,
  diffBlocks,
  diffInline,
  diffTextLines,
  splitBlocks,
  type InlineDiff,
} from "@/lib/diff/blocks";

/** 把 inline diff 按类型拼回文本，便于校验「前后文本可还原」 */
function joinInline(parts: InlineDiff[], types: Array<InlineDiff["type"]>): string {
  return parts
    .filter((part) => types.includes(part.type))
    .map((part) => part.text)
    .join("");
}

describe("splitBlocks", () => {
  it("空正文返回空数组", () => {
    expect(splitBlocks("")).toEqual([]);
    expect(splitBlocks("   \n  ")).toEqual([]);
  });

  it("按顶层段落拆块并保留 html", () => {
    const blocks = splitBlocks("<p>第一段</p><p>第二段</p>");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].html).toBe("<p>第一段</p>");
    expect(blocks[0].text).toBe("第一段");
    expect(blocks[1].html).toBe("<p>第二段</p>");
    expect(blocks[0].id).toMatch(/^b0_[a-z0-9]{1,6}$/);
    expect(blocks[1].id).toMatch(/^b1_[a-z0-9]{1,6}$/);
  });

  it("纯文本会被包成段落", () => {
    const blocks = splitBlocks("只有一句话");
    expect(blocks).toHaveLength(1);
    expect(blocks[0].html).toBe("<p>只有一句话</p>");
    expect(blocks[0].text).toBe("只有一句话");
  });

  it("块标签外的残余文本单独成段", () => {
    const blocks = splitBlocks("前言<p>正文</p>");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].html).toBe("<p>前言</p>");
    expect(blocks[1].html).toBe("<p>正文</p>");
  });

  it("支持标题、引用、列表等块级标签", () => {
    const blocks = splitBlocks("<h2>标题</h2><blockquote><p>引用</p></blockquote><li>条目</li>");
    expect(blocks).toHaveLength(3);
    expect(blocks[0].html).toBe("<h2>标题</h2>");
    expect(blocks[0].text).toBe("标题");
    expect(blocks[1].html).toBe("<blockquote><p>引用</p></blockquote>");
    expect(blocks[1].text).toBe("引用");
    expect(blocks[2].text).toBe("条目");
  });

  it("id 由块序号与文本哈希组成，同文本同 id", () => {
    const a = splitBlocks("<p>同样的句子</p>");
    const b = splitBlocks("<p>同样的句子</p>");
    expect(a[0].id).toBe(b[0].id);
  });
});

describe("diffInline", () => {
  it("完全相同返回单个 same", () => {
    expect(diffInline("正文", "正文")).toEqual([{ type: "same", text: "正文" }]);
  });

  it("两边都为空返回空数组", () => {
    expect(diffInline("", "")).toEqual([]);
  });

  it("标出插入的字", () => {
    expect(diffInline("abc", "abXc")).toEqual([
      { type: "same", text: "ab" },
      { type: "add", text: "X" },
      { type: "same", text: "c" },
    ]);
  });

  it("标出删除的字", () => {
    expect(diffInline("abXc", "abc")).toEqual([
      { type: "same", text: "ab" },
      { type: "del", text: "X" },
      { type: "same", text: "c" },
    ]);
  });

  it("公共前后缀保留为 same，可还原原文与新文", () => {
    const before = "他推开那扇门，走了进去。";
    const after = "他轻轻推开那扇门，走了进去。";
    const parts = diffInline(before, after);
    expect(joinInline(parts, ["same", "del"])).toBe(before);
    expect(joinInline(parts, ["same", "add"])).toBe(after);
    expect(parts.some((part) => part.type === "add")).toBe(true);
  });

  it("纯新增与纯删除", () => {
    expect(diffInline("", "新增内容")).toEqual([{ type: "add", text: "新增内容" }]);
    expect(diffInline("删除内容", "")).toEqual([{ type: "del", text: "删除内容" }]);
  });
});

describe("diffBlocks", () => {
  it("正文相同时没有变化", () => {
    const diff = diffBlocks("<p>一</p><p>二</p>", "<p>一</p><p>二</p>");
    expect(diff.items).toEqual([]);
    expect(diff).toMatchObject({ added: 0, removed: 0, changed: 0 });
  });

  it("忽略块内多余空白后视为同一块", () => {
    const diff = diffBlocks("<p>第一 段</p>", "<p>第一段</p>");
    expect(diff.changed).toBe(0);
    expect(diff.added).toBe(0);
    expect(diff.removed).toBe(0);
  });

  it("新增段落记录 added 并带 anchorId", () => {
    const diff = diffBlocks("<p>A</p>", "<p>A</p><p>B</p>");
    expect(diff.added).toBe(1);
    expect(diff.removed).toBe(0);
    expect(diff.changed).toBe(0);
    const change = diff.items[0];
    expect(change.type).toBe("added");
    expect(change.after).toBe("<p>B</p>");
    expect(change.afterText).toBe("B");
    // 插到 A 之后
    expect(change.anchorId).toBe(splitBlocks("<p>A</p>")[0].id);
  });

  it("删除段落记录 removed 并保留 before", () => {
    const diff = diffBlocks("<p>A</p><p>B</p>", "<p>A</p>");
    expect(diff.removed).toBe(1);
    const change = diff.items[0];
    expect(change.type).toBe("removed");
    expect(change.before).toBe("<p>B</p>");
    expect(change.beforeText).toBe("B");
  });

  it("改动段落记录 changed 并给出逐字 diff", () => {
    const diff = diffBlocks("<p>A</p><p>B</p>", "<p>A</p><p>B2</p>");
    expect(diff.changed).toBe(1);
    const change = diff.items[0];
    expect(change.type).toBe("changed");
    expect(change.before).toBe("<p>B</p>");
    expect(change.after).toBe("<p>B2</p>");
    expect(change.inline).toEqual([
      { type: "same", text: "B" },
      { type: "add", text: "2" },
    ]);
  });

  it("插入到正文开头时 anchorId 为 null", () => {
    const diff = diffBlocks("<p>A</p>", "<p>B</p><p>A</p>");
    expect(diff.added).toBe(1);
    expect(diff.items[0].anchorId).toBeNull();
  });

  it("同时有增删改时计数正确", () => {
    const before = "<p>开头</p><p>删掉</p><p>中间</p><p>改旧</p>";
    const after = "<p>开头</p><p>中间</p><p>改新</p><p>新增</p>";
    const diff = diffBlocks(before, after);
    expect(diff.removed).toBe(1);
    expect(diff.changed).toBe(1);
    expect(diff.added).toBe(1);
    expect(diff.items).toHaveLength(3);
    expect(diff.items.map((item) => item.type)).toEqual(["removed", "changed", "added"]);
  });
});

describe("applyBlockDiff", () => {
  it("不接受任何改动时保持原文", () => {
    const before = "<p>A</p><p>B</p>";
    const after = "<p>A</p><p>B2</p><p>C</p>";
    const diff = diffBlocks(before, after);
    expect(applyBlockDiff(before, diff, [])).toBe(before);
  });

  it("接受 changed 时替换对应块", () => {
    const before = "<p>A</p><p>B</p>";
    const after = "<p>A</p><p>B2</p>";
    const diff = diffBlocks(before, after);
    const changed = diff.items.filter((item) => item.type === "changed").map((item) => item.id);
    expect(applyBlockDiff(before, diff, changed)).toBe("<p>A</p><p>B2</p>");
  });

  it("接受 added 时插入到 anchorId 之后", () => {
    const before = "<p>A</p>";
    const after = "<p>A</p><p>B</p>";
    const diff = diffBlocks(before, after);
    const added = diff.items.filter((item) => item.type === "added").map((item) => item.id);
    expect(applyBlockDiff(before, diff, added)).toBe("<p>A</p><p>B</p>");
  });

  it("接受 removed 时删除对应块", () => {
    const before = "<p>A</p><p>B</p>";
    const after = "<p>A</p>";
    const diff = diffBlocks(before, after);
    const removed = diff.items.filter((item) => item.type === "removed").map((item) => item.id);
    expect(applyBlockDiff(before, diff, removed)).toBe("<p>A</p>");
  });

  it("全部接受后结果与 AI 给出的新正文一致", () => {
    const before = "<p>第一段</p><p>第二段</p><p>第三段</p>";
    const after = "<p>第一段</p><p>第二段改</p><p>第四段</p>";
    const diff = diffBlocks(before, after);
    const all = diff.items.map((item) => item.id);
    expect(applyBlockDiff(before, diff, all)).toBe(after);
  });
});

describe("diffTextLines", () => {
  it("整段改写后多出的段落保持在替换段落之后", () => {
    const before="<p>原开头</p><p>原结尾</p>";
    const after="<p>新开头</p><p>新中段</p><p>新结尾</p>";
    const diff=diffBlocks(before,after);
    expect(applyBlockDiff(before,diff,diff.items.map(c=>c.id))).toBe(after);
  });
  it("逐行比较并标出增删", () => {
    expect(diffTextLines("第一行\n第二行", "第一行\n第三行")).toEqual([
      { type: "same", text: "第一行" },
      { type: "del", text: "第二行" },
      { type: "add", text: "第三行" },
    ]);
  });

  it("完全相同全部为 same", () => {
    const lines = diffTextLines("a\nb", "a\nb");
    expect(lines.every((line) => line.type === "same")).toBe(true);
  });
});
