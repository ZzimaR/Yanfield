import { describe, expect, it } from "vitest";
import {
  appendTaskConstraint,
  buildFieldInstruction,
  composeAssistBrief,
  labeledDraft,
  resolveTaskAuthorText,
} from "@/lib/ai/assist-brief";

describe("buildFieldInstruction", () => {
  it("有草稿时按完善来写，并限制只输出该字段", () => {
    const text = buildFieldInstruction("write", "设定摘要", true);
    expect(text).toContain("请完善「设定摘要」");
    expect(text).toContain("只输出这个字段的成稿");
  });

  it("没有草稿时仍要求按想法展开", () => {
    const text = buildFieldInstruction("write", "设定正文", false);
    expect(text).toContain("请帮我写「设定正文」");
    expect(text).toContain("不要换成别的内容");
  });
});

describe("composeAssistBrief", () => {
  it("把想法和已有草稿都放进作者任务", () => {
    const brief = composeAssistBrief({
      instruction: "请完善「设定摘要」。",
      idea: "只在退潮时开启",
      draft: "渡口会开门",
    });
    expect(brief.message).toContain("请完善「设定摘要」。");
    expect(brief.message).toContain("渡口会开门");
    expect(brief.message).toContain("我的想法（优先遵守）：\n只在退潮时开启");
    expect(brief.instruction).toBe(brief.message);
    expect(brief.selection).toBe("渡口会开门");
  });

  it("想法和草稿都空时只保留指令", () => {
    const brief = composeAssistBrief({ instruction: "请补全摘要。", idea: "  ", draft: "" });
    expect(brief.message).toBe("请补全摘要。");
    expect(brief.selection).toBeUndefined();
  });
});

describe("labeledDraft", () => {
  it("跳过空白字段", () => {
    expect(
      labeledDraft([
        { label: "摘要", value: " 退潮开门 " },
        { label: "正文", value: "   " },
      ]),
    ).toBe("摘要：\n退潮开门");
  });
});

describe("resolveTaskAuthorText", () => {
  it("没有 message 时用 instruction 顶上", () => {
    expect(resolveTaskAuthorText(undefined, " 请写摘要 ")).toEqual({
      message: "请写摘要",
      instruction: "请写摘要",
    });
  });
});

describe("appendTaskConstraint", () => {
  it("有作者任务时在末尾加上字段级约束", () => {
    expect(appendTaskConstraint("请输出设定卡。", "写摘要")).toContain("不要扩写成整份大纲或整张卡片");
  });

  it("没有作者任务时不追加", () => {
    expect(appendTaskConstraint("原文", "  ")).toBe("原文");
  });
});
