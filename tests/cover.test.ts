import { describe, expect, it } from "vitest";
import { customCoverKey, parseCustomCover, resolveCoverStyle } from "@/lib/cover";

describe("resolveCoverStyle", () => {
  it("预置底色原样返回", () => {
    expect(resolveCoverStyle("cinnabar").label).toBe("朱砂");
  });

  it("自定义双色能解析，并给出可读字色", () => {
    const style = resolveCoverStyle(customCoverKey("#f4efe4", "#d8c7a1"));
    expect(style.label).toBe("自定义");
    expect(style.from).toBe("#f4efe4");
    expect(style.ink).toBe("#1c1915");
  });

  it("空值和脏数据回退到墨夜", () => {
    expect(resolveCoverStyle("").label).toBe("墨夜");
    expect(resolveCoverStyle("custom:red:blue").label).toBe("墨夜");
  });
});

describe("parseCustomCover", () => {
  it("只接受两个六位色值", () => {
    expect(parseCustomCover("custom:#112233:#abcdef")).toEqual({ from: "#112233", to: "#abcdef" });
    expect(parseCustomCover("ink")).toBeNull();
  });
});
