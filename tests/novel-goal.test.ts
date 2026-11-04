import { describe, expect, it } from "vitest";
import { isValidNovelWordGoal, MAX_NOVEL_WORD_GOAL } from "@/lib/novel-goal";

describe("全书目标字数校验", () => {
  it("接受零和上限内的整数", () => {
    expect(isValidNovelWordGoal(0)).toBe(true);
    expect(isValidNovelWordGoal(1_000_000)).toBe(true);
    expect(isValidNovelWordGoal(MAX_NOVEL_WORD_GOAL)).toBe(true);
  });

  it("拒绝负数、小数和超过上限的值", () => {
    expect(isValidNovelWordGoal(-1)).toBe(false);
    expect(isValidNovelWordGoal(1.5)).toBe(false);
    expect(isValidNovelWordGoal(MAX_NOVEL_WORD_GOAL + 1)).toBe(false);
    expect(isValidNovelWordGoal(1e20)).toBe(false);
  });
});
