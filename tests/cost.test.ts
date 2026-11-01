import { describe, expect, it } from "vitest";
import { estimateAiCost, formatCny } from "@/lib/ai/cost";

describe("estimateAiCost", () => {
  it("没填单价时不估算金额", () => {
    expect(estimateAiCost(1000, 500, { inputPerMillion: 0, outputPerMillion: 0 })).toBeNull();
  });

  it("按百万 token 单价分别计算输入和输出", () => {
    expect(estimateAiCost(1_000_000, 500_000, { inputPerMillion: 2, outputPerMillion: 8 })).toBe(6);
  });
});

describe("formatCny", () => {
  it("小额保留更多小数", () => {
    expect(formatCny(0.0032)).toBe("¥0.0032");
    expect(formatCny(1.2)).toBe("¥1.20");
  });
});
