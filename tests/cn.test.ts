import { describe, expect, it } from "vitest";
import {
  clamp,
  countWords,
  diffLines,
  estimateTokens,
  formatNumber,
  formatWords,
  stripHtml,
  truncate,
} from "@/lib/ui/cn";

describe("countWords", () => {
  it("空文本与纯空白返回 0", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   \n\t ")).toBe(0);
  });

  it("中文按字计数，忽略标点与空白", () => {
    expect(countWords("他走了。")).toBe(3);
    expect(countWords("潮信要送出。")).toBe(5);
  });

  it("英文与数字按词/串计数", () => {
    expect(countWords("hello world")).toBe(2);
    expect(countWords("chapter 12")).toBe(2);
    expect(countWords("第一章 hello 2026")).toBe(5);
  });

  it("先剥离 HTML 标签再计数", () => {
    expect(countWords("<p>你好</p>")).toBe(2);
    expect(countWords("<p>a<br>b</p>")).toBe(2);
  });

  it("处理常见 HTML 实体", () => {
    expect(countWords("A&amp;B")).toBe(2);
    expect(countWords("&nbsp;")).toBe(0);
  });
});

describe("formatWords", () => {
  it("小于一千原样输出", () => {
    expect(formatWords(0)).toBe("0");
    expect(formatWords(999)).toBe("999");
  });

  it("一千到一万之间用千分位", () => {
    expect(formatWords(1000)).toBe("1,000");
    expect(formatWords(9999)).toBe("9,999");
  });

  it("一万以上折算为「万」", () => {
    expect(formatWords(10000)).toBe("1 万");
    expect(formatWords(20000)).toBe("2 万");
    expect(formatWords(12345)).toBe("1.2 万");
    expect(formatWords(99999)).toBe("10.0 万");
  });

  it("非有限数兜底为 0", () => {
    expect(formatWords(Number.NaN)).toBe("0");
    expect(formatWords(Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("formatNumber", () => {
  it("使用中文千分位", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(1000000)).toBe("1,000,000");
  });
});

describe("truncate", () => {
  it("空字符串返回空", () => {
    expect(truncate("")).toBe("");
  });

  it("未超长时原样返回", () => {
    expect(truncate("三体", 40)).toBe("三体");
  });

  it("超长时截断并加省略号（默认 40 字）", () => {
    expect(truncate("abcdef", 3)).toBe("abc…");
    expect(truncate("字".repeat(41))).toBe(`${"字".repeat(40)}…`);
  });

  it("按 Unicode 字符而不是 UTF-16 码元截断", () => {
    expect(truncate("😀😀😀", 2)).toBe("😀😀…");
  });
});

describe("clamp", () => {
  it("夹在区间内", () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
    expect(clamp(3, 3, 3)).toBe(3);
  });
});

describe("stripHtml", () => {
  it("把块级闭合标签与 br 转成换行", () => {
    expect(stripHtml("<p>第一段</p><p>第二段</p>")).toBe("第一段\n第二段");
    expect(stripHtml("<p>你好<br>世界</p>")).toBe("你好\n世界");
  });

  it("还原常用实体", () => {
    expect(stripHtml("<p>a &amp; b</p>")).toBe("a & b");
    expect(stripHtml("<p>&lt;tag&gt;</p>")).toBe("<tag>");
    expect(stripHtml("<p>&quot;引号&quot;</p>")).toBe('"引号"');
  });

  it("压缩多余空行并 trim", () => {
    expect(stripHtml("<p>a</p><p></p><p></p><p>b</p>")).toBe("a\n\nb");
  });
});

describe("diffLines", () => {
  it("完全相同时合并为一段 same", () => {
    expect(diffLines("a\nb", "a\nb")).toEqual([{ type: "same", text: "a\nb" }]);
  });

  it("标出删除与新增行", () => {
    expect(diffLines("a\nb", "a\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "c" },
    ]);
  });

  it("整段替换", () => {
    expect(diffLines("旧文", "新文")).toEqual([
      { type: "del", text: "旧文" },
      { type: "add", text: "新文" },
    ]);
  });

  it("超大输入退化为整体替换（避免 O(n*m) 爆炸）", () => {
    const lines = (prefix: string) => Array.from({ length: 700 }, (_, i) => `${prefix}${i}`).join("\n");
    const result = diffLines(lines("a"), lines("b"));
    expect(result).toHaveLength(1400);
    expect(result[0].type).toBe("del");
    expect(result[result.length - 1].type).toBe("add");
  });
});

describe("estimateTokens", () => {
  it("空文本返回 0", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("中文按 1.5 字/token 估算", () => {
    // 3 个汉字 → ceil(3 / 1.5) = 2
    expect(estimateTokens("你好啊")).toBe(2);
  });

  it("英文按 3.5 字符/token 估算", () => {
    // 7 个字符 → ceil(7 / 3.5) = 2
    expect(estimateTokens("abcdefg")).toBe(2);
  });

  it("中英混排分别折算后向上取整", () => {
    // 2 个汉字 + 3 个英文 → ceil(2/1.5 + 3/3.5) = ceil(2.19) = 3
    expect(estimateTokens("你好abc")).toBe(3);
  });
});
