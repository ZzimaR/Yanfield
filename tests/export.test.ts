import { describe, expect, it } from "vitest";
import { marked } from "marked";
import { buildExport, type ExportScope } from "@/app/api/_lib/export";
import type { Chapter, Novel, Volume } from "@/lib/types";

const novel: Novel = {
  id: "novel", title: "测试作品", subtitle: "", author: "", genre: "奇幻", tags: [], synopsis: "",
  coverKey: "ink", status: "draft", wordGoal: 0, targetChapters: 0, styleGuide: "", pov: "",
  forbiddenWords: [], createdAt: "", updatedAt: "", lastOpenedAt: null,
};
const volume: Volume = {
  id: "volume", novelId: novel.id, title: "第一卷", summary: "", orderIndex: 0, createdAt: "", updatedAt: "",
};
const chapter: Chapter = {
  id: "chapter", novelId: novel.id, volumeId: volume.id, title: "第一章", content: "",
  summary: "", status: "draft", orderIndex: 0, wordCount: 0, notes: "", createdAt: "", updatedAt: "",
};

function exportChapter(content: string, format: "md" | "txt", scope: ExportScope = "chapter"): string {
  return buildExport({
    novel,
    format,
    scope,
    volumes: [{ volume, chapters: [{ ...chapter, content }] }],
    looseChapters: [],
  }).body;
}

describe("作品导出", () => {
  it.each<ExportScope>(["book", "volume", "chapter"])("Markdown 的 %s 范围保留正文格式和段落", async (scope) => {
    const content = [
      "<p><strong>Bold</strong> first.</p>",
      "<p><em>Italic</em> second. <u>under</u> <s>strike</s> <mark>highlight</mark></p>",
      "<ul><li>One item</li><li>Two items</li></ul>",
      "<blockquote><p>Quoted text</p></blockquote>",
    ].join("");
    const output = exportChapter(content, "md", scope);
    expect(output).toContain("**Bold** first.\n\n*Italic* second.");
    expect(output).toContain("<u>under</u>");
    expect(output).toContain("~~strike~~");
    expect(output).toContain("<mark>highlight</mark>");
    expect(output).toMatch(/^- +One item/m);
    expect(output).toContain("> Quoted text");

    const rendered = await marked.parse(output);
    expect(rendered).toContain("<strong>Bold</strong>");
    expect(rendered).toContain("<em>Italic</em>");
    expect(rendered).toContain("<li>One item</li>");
  });

  it("保留代码块内的连续空行和旧版纯文本内容", () => {
    expect(exportChapter("<pre><code>one\n\n\nfour</code></pre>", "md")).toContain("one\n\n\nfour");
    expect(exportChapter("2 < 3 & 4", "md")).toContain("2 < 3 & 4");
  });

  it("TXT 仍导出纯文本，不带 Markdown 标记", () => {
    const output = exportChapter("<p><strong>Bold</strong> first.</p><p>Second.</p>", "txt");
    expect(output).toContain("Bold first.\nSecond.");
    expect(output).not.toContain("**Bold**");
  });
});
