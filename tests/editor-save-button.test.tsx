import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SaveButton } from "@/components/editor/SaveButton";
import { SaveIndicator } from "@/components/editor/SaveIndicator";

describe("手动保存入口", () => {
  it("提供有文字和无障碍名称的保存按钮", () => {
    const html = renderToStaticMarkup(<SaveButton onSave={() => {}} saving={false} />);
    expect(html).toContain('aria-label="保存当前章节"');
    expect(html).toContain(">保存</button>");
    expect(html).not.toContain('disabled=""');
  });

  it("保存期间禁用按钮，并避免对自动保存延迟作错误提示", () => {
    const button = renderToStaticMarkup(<SaveButton onSave={() => {}} saving />);
    const indicator = renderToStaticMarkup(<SaveIndicator state="dirty" lastSavedAt={null} />);
    expect(button).toContain('disabled=""');
    expect(indicator).toContain("有未保存的修改");
    expect(indicator).not.toContain("1.2 秒");
  });
});
