import { describe, expect, it } from "vitest";
import { filterDisclosed, isDisclosed } from "@/lib/ai/context";
import { DEMO_CHARACTERS, DEMO_WORLD } from "@/lib/defaults";

/**
 * 渐进披露（防剧透）纯逻辑单测。
 * 只测 context.ts 导出的纯函数，不连数据库：数据库句柄在 getDb() 里才创建，模块导入本身无副作用。
 */
describe("isDisclosed", () => {
  it("揭示章节留空 = 任何章节都可见", () => {
    expect(isDisclosed({ aiVisible: true, revealAtChapter: null }, 1)).toBe(true);
    expect(isDisclosed({ aiVisible: true, revealAtChapter: null }, 99)).toBe(true);
  });

  it("没有章节上下文时不过滤（聊天场景）", () => {
    expect(isDisclosed({ aiVisible: true, revealAtChapter: 10 }, null)).toBe(true);
  });

  it("只有写到揭示章节及之后才可见", () => {
    const item = { aiVisible: true, revealAtChapter: 6 };
    expect(isDisclosed(item, 1)).toBe(false);
    expect(isDisclosed(item, 5)).toBe(false);
    expect(isDisclosed(item, 6)).toBe(true);
    expect(isDisclosed(item, 7)).toBe(true);
  });

  it("「对 AI 可见」关闭时永远不可见", () => {
    expect(isDisclosed({ aiVisible: false, revealAtChapter: null }, 1)).toBe(false);
    expect(isDisclosed({ aiVisible: false, revealAtChapter: 6 }, 10)).toBe(false);
  });
});

describe("filterDisclosed", () => {
  const items = [
    { name: "一直可见", aiVisible: true, revealAtChapter: null },
    { name: "第十章才出场", aiVisible: true, revealAtChapter: 10 },
    { name: "隐藏卡", aiVisible: false, revealAtChapter: null },
    { name: "第六章出场", aiVisible: true, revealAtChapter: 6 },
  ];

  it("按当前章节过滤，并保持原顺序", () => {
    expect(filterDisclosed(items, 1).map((item) => item.name)).toEqual(["一直可见"]);
    expect(filterDisclosed(items, 6).map((item) => item.name)).toEqual(["一直可见", "第六章出场"]);
    expect(filterDisclosed(items, 10).map((item) => item.name)).toEqual(["一直可见", "第十章才出场", "第六章出场"]);
  });

  it("不修改传入数组", () => {
    const before = items.map((item) => item.name);
    filterDisclosed(items, 1);
    expect(items.map((item) => item.name)).toEqual(before);
  });

  it("章节未知时只按 aiVisible 过滤", () => {
    expect(filterDisclosed(items, null).map((item) => item.name)).toEqual(["一直可见", "第十章才出场", "第六章出场"]);
  });
});

describe("demo seed 不再提前埋雷", () => {
  it("小满 / 顾衡 的揭示章节为 null（否则第一章 AI 看不到）", () => {
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
    const names = filterDisclosed(DEMO_CHARACTERS, 1).map((character) => character.name);
    for (const name of ["周晚", "小满", "顾衡", "陈伯"]) expect(names).toContain(name);
  });

  it("demo 世界观在第一章全部可见", () => {
    expect(filterDisclosed(DEMO_WORLD, 1)).toHaveLength(DEMO_WORLD.length);
  });
});
