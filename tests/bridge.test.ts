import { describe, expect, it } from "vitest";
import { textToInsertHtml } from "@/lib/editor/bridge";

describe("textToInsertHtml", () => {
  it("空文本与纯空白返回空串", () => {
    expect(textToInsertHtml("")).toBe("");
    expect(textToInsertHtml("   \n\t  ")).toBe("");
    // 防御性处理：运行期可能传入 null/undefined
    expect(textToInsertHtml(undefined as unknown as string)).toBe("");
  });

  it("单段纯文本包成一个段落", () => {
    expect(textToInsertHtml("他推开门。")).toBe("<p>他推开门。</p>");
  });

  it("空行分段，空行内部换行转成 <br>", () => {
    expect(textToInsertHtml("第一段\n\n第二段")).toBe("<p>第一段</p><p>第二段</p>");
    expect(textToInsertHtml("第一行\n第二行")).toBe("<p>第一行<br>第二行</p>");
  });

  it("转义 HTML 特殊字符", () => {
    expect(textToInsertHtml("a & b < c > d")).toBe("<p>a &amp; b &lt; c &gt; d</p>");
  });

  it("支持 **加粗** 简写，且转义先于加粗替换", () => {
    expect(textToInsertHtml("这是 **重点**")).toBe("<p>这是 <strong>重点</strong></p>");
    expect(textToInsertHtml("**a & b**")).toBe("<p><strong>a &amp; b</strong></p>");
  });

  it("统一 CRLF 换行", () => {
    expect(textToInsertHtml("第一段\r\n\r\n第二段")).toBe("<p>第一段</p><p>第二段</p>");
  });

  it("输入本身是 HTML 时原样返回", () => {
    const html = '<p class="x">已有段落</p>';
    expect(textToInsertHtml(html)).toBe(html);
    expect(textToInsertHtml('  <h2>标题</h2>')).toBe("<h2>标题</h2>");
  });

  it("首尾空白会被裁掉", () => {
    expect(textToInsertHtml("\n  正文  \n")).toBe("<p>正文</p>");
  });
});
