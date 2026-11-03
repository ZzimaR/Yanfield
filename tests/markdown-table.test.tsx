import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "@/components/ui/kit";

describe("Markdown 表格", () => {
  it("把管道表格渲染成 table", () => {
    const html = renderToStaticMarkup(
      <Markdown text={"| 名称 | 方位 | 状态 |\n| --- | --- | --- |\n| 北部天山 | 北侧 | 既定 |\n| 东屏山 | 东侧 | 新定 |"} />,
    );
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("北部天山");
    expect(html).toContain("东屏山");
    expect(html).toContain("</table>");
  });

  it("带对齐标记的分隔行也能识别", () => {
    const html = renderToStaticMarkup(
      <Markdown text={"| 城 | 人口 |\n|:---|---:|\n| 青阳城 | 20-30 万 |"} />,
    );
    expect(html).toContain("<table");
    expect(html).toContain("青阳城");
  });

  it("只有一个 | 的普通段落不会被误判成表格", () => {
    const html = renderToStaticMarkup(<Markdown text={"周晚把信翻过去，摇了摇头。\n| 这不是表格。"} />);
    expect(html).not.toContain("<table");
    expect(html).toContain("这不是表格");
  });

  it("表格单元格里的加粗仍然生效", () => {
    const html = renderToStaticMarkup(
      <Markdown text={"| 名称 |\n| --- |\n| **澜国** |"} />,
    );
    expect(html).toContain("<strong>澜国</strong>");
  });
  it("转义管道不会拆成额外单元格",()=>{
    const html=renderToStaticMarkup(<Markdown text={"| 名称 | 说明 |\n| --- | --- |\n| A\\|B | 保留 |"}/>);
    expect(html).toContain("A|B");expect((html.match(/<td/g)||[]).length).toBe(2);
  });

});


describe("Markdown 文本转义",()=>{
 it("引号、单引号和与号只由 React 转义一次",()=>{
  const html=renderToStaticMarkup(<Markdown text={'称呼 "素"，A & B，it’s fine。'}/>);
  expect(html).toContain('&quot;素&quot;');expect(html).not.toContain('&amp;quot;');expect(html).not.toContain('&amp;amp;');
 });
 it("原始 HTML 保持文本，不创建标签或事件",()=>{
  const html=renderToStaticMarkup(<Markdown text={'<img src=x onerror="alert(1)"> <script>alert(1)</script>'}/>);
  expect(html).not.toContain('<img');expect(html).not.toContain('<script');expect(html).toContain('&lt;img');
 });
 it("链接参数中的与号不会被重复编码",()=>{
  const html=renderToStaticMarkup(<Markdown text={'[资料](https://example.com/?a=1&b=2)'}/>);
  expect(html).toContain('href="https://example.com/?a=1&amp;b=2"');expect(html).not.toContain('&amp;amp;');
 });
});
