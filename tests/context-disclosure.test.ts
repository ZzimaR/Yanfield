import { describe, expect, it } from "vitest";
import { filterAiVisible, isAiVisibleAtChapter } from "@/lib/ai/context";
import { agentPreamble } from "@/lib/ai/prompts";
import { DEMO_CHARACTERS, DEMO_WORLD } from "@/lib/defaults";
import { DEFAULT_APP_SETTINGS } from "@/lib/types";

/**
 * 上下文可见性纯逻辑单测。
 * - AI 只看到已揭示且 aiVisible=true 的卡；
 * - 智能体提示词要求仅依据实际提供或作者明确引用的资料。
 * 只测纯函数，不连数据库：数据库句柄在 getDb() 里才创建，模块导入本身无副作用。
 */
describe("filterAiVisible", () => {
  const items = [
    { name: "一直可见", aiVisible: true },
    { name: "早就揭示", aiVisible: true },
    { name: "隐藏卡", aiVisible: false },
  ];

  it("只过滤 aiVisible=false 的卡，保持原顺序", () => {
    expect(filterAiVisible(items).map((item) => item.name)).toEqual(["一直可见", "早就揭示"]);
  });

  it("不修改传入数组", () => {
    const before = items.map((item) => item.name);
    filterAiVisible(items);
    expect(items.map((item) => item.name)).toEqual(before);
  });
});

describe("isAiVisibleAtChapter", () => {
  it("未设置揭示章节时，AI 可见性开关决定是否可见", () => {
    expect(isAiVisibleAtChapter({ aiVisible: true, revealAtChapter: null }, 1)).toBe(true);
    expect(isAiVisibleAtChapter({ aiVisible: false, revealAtChapter: null }, 1)).toBe(false);
  });

  it("无章节上下文时，未设定揭示章节的卡默认隐藏", () => {
    expect(isAiVisibleAtChapter({ aiVisible: true, revealAtChapter: 6 }, null)).toBe(false);
  });

  it("在揭示章节之前隐藏", () => {
    expect(isAiVisibleAtChapter({ aiVisible: true, revealAtChapter: 6 }, 1)).toBe(false);
    expect(isAiVisibleAtChapter({ aiVisible: true, revealAtChapter: 6 }, 5)).toBe(false);
  });

  it("作者明确引用可覆盖揭示章节，但不能覆盖 AI 隐藏开关", () => {
    expect(isAiVisibleAtChapter({ aiVisible: true, revealAtChapter: 6 }, 1, true)).toBe(true);
    expect(isAiVisibleAtChapter({ aiVisible: false, revealAtChapter: 6 }, 1, true)).toBe(false);
  });

  it("到达揭示章节后可见", () => {
    expect(isAiVisibleAtChapter({ aiVisible: true, revealAtChapter: 6 }, 6)).toBe(true);
    expect(isAiVisibleAtChapter({ aiVisible: true, revealAtChapter: 6 }, 7)).toBe(true);
  });
});

describe("demo seed 没有未揭示标注", () => {
  it("小满 / 顾衡 / 周晚 的揭示章节为 null", () => {
    const byName = new Map(DEMO_CHARACTERS.map((character) => [character.name, character]));
    expect(byName.get("小满")?.revealAtChapter).toBeNull();
    expect(byName.get("顾衡")?.revealAtChapter).toBeNull();
    expect(byName.get("周晚")?.revealAtChapter).toBeNull();
  });

  it("税关的揭示章节为 null", () => {
    const taxOffice = DEMO_WORLD.find((setting) => setting.title === "税关");
    expect(taxOffice?.revealAtChapter).toBeNull();
  });

  it("第一章上下文里四个 demo 角色都在", () => {
    const names = filterAiVisible(DEMO_CHARACTERS).map((character) => character.name);
    for (const name of ["周晚", "小满", "顾衡", "陈伯"]) expect(names).toContain(name);
  });

  it("demo 世界观在第一章全部可见", () => {
    expect(filterAiVisible(DEMO_WORLD)).toHaveLength(DEMO_WORLD.length);
  });
});

describe("智能体提示词的知识边界", () => {
  it("内置智能体只依据本轮提供的资料", () => {
    const text = agentPreamble("writer", DEFAULT_APP_SETTINGS);
    expect(text).toContain("提供或作者明确引用的资料");
    expect(text).toContain("不假定未提供");
    expect(text).toContain("当前章节已揭示");
  });

  it("主编与设定智能体同样遵守资料边界", () => {
    for (const agentId of ["supervisor", "setting"] as const) {
      const text = agentPreamble(agentId, DEFAULT_APP_SETTINGS);
      expect(text).toContain("不假定未提供");
    }
  });

  it("自定义智能体同样带约束", () => {
    const text = agentPreamble("custom", DEFAULT_APP_SETTINGS);
    expect(text).toContain("不假定未提供");
    expect(text).toContain("当前章节已揭示");
  });
});
