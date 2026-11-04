import { describe, expect, it } from "vitest";
import { estimateTokens } from "@/lib/ui/cn";
import { trimContextSections, type ContextSectionMeta } from "@/lib/ai/context";

function makeSection(
  id: ContextSectionMeta["id"],
  label: string,
  text: string,
  priority: number,
): ContextSectionMeta {
  return {
    id,
    label,
    text,
    tokens: estimateTokens(`【${label}】\n${text}`),
    included: true,
    truncated: false,
    priority,
  };
}

describe("trimContextSections", () => {
  it("先丢低优先资料，并保留本章章纲和用户明确选中的片段", () => {
    const world = makeSection("world", "世界观设定", "次要资料".repeat(80), 20);
    const blueprint = makeSection("chapter-blueprint", "本章章纲", "本章目标与关键事件", 95);
    const selection = makeSection("selection", "选中片段", "作者指定的内容", 100);
    const sections = [world, blueprint, selection];
    const budget = estimateTokens("【本章章纲】\n本章目标与关键事件\n\n【选中片段】\n作者指定的内容");

    const result = trimContextSections(sections, budget);

    expect(world.included).toBe(false);
    expect(blueprint.included).toBe(true);
    expect(selection.included).toBe(true);
    expect(result.dropped).toContain("world");
    expect(result.tokens).toBeLessThanOrEqual(budget);
  });

  it("预算统计包含分节标题，且紧张时优先截断章纲而非选中内容", () => {
    const blueprint = makeSection("chapter-blueprint", "本章章纲", "章纲内容".repeat(100), 95);
    const selection = makeSection("selection", "选中片段", "作者选中的关键原文", 100);
    const sections = [blueprint, selection];
    const budget = estimateTokens("【选中片段】\n作者选中的关键原文");

    const result = trimContextSections(sections, budget);

    expect(selection.included).toBe(true);
    expect(selection.truncated).toBe(false);
    expect(result.tokens).toBeLessThanOrEqual(budget);
    expect(result.tokens).toBe(estimateTokens("【选中片段】\n作者选中的关键原文"));
  });

  it("不限预算时返回包含分节标题的完整文本估算", () => {
    const section = makeSection("novel-outline", "作品总纲", "故事主线", 50);

    const result = trimContextSections([section], 0);

    expect(result.tokens).toBe(estimateTokens("【作品总纲】\n故事主线"));
    expect(result.dropped).toEqual([]);
  });

  it("条目级裁剪优先删除最不相关角色资料", () => {
    const characters = makeSection(
      "characters",
      "角色资料",
      `- 与本章相关的角色：${"相关设定".repeat(20)}\n- 次相关角色：${"次要设定".repeat(20)}\n- 无关角色：${"无关设定".repeat(20)}`,
      25,
    );
    const budget = estimateTokens(
      `【角色资料】\n- 与本章相关的角色：${"相关设定".repeat(20)}\n- 次相关角色：${"次要设定".repeat(20)}\n…（其余资料已按相关性省略）`,
    );

    const result = trimContextSections([characters], budget);

    expect(characters.text).toContain("与本章相关的角色");
    expect(characters.text).toContain("次相关角色");
    expect(characters.text).not.toContain("无关角色");
    expect(characters.truncated).toBe(true);
    expect(result.tokens).toBeLessThanOrEqual(budget);
  });

  it("前情摘要超预算时先删除最早章节", () => {
    const summaries = makeSection(
      "chapter-summaries",
      "前情摘要",
      `第1章：较早剧情${"旧情节".repeat(20)}\n第2章：次近剧情${"次近情节".repeat(20)}\n第3章：最近剧情${"最新情节".repeat(20)}`,
      30,
    );
    const budget = estimateTokens(
      `【前情摘要】\n第2章：次近剧情${"次近情节".repeat(20)}\n第3章：最近剧情${"最新情节".repeat(20)}\n…（其余资料已按相关性省略）`,
    );

    const result = trimContextSections([summaries], budget);

    expect(summaries.text).not.toContain("第1章");
    expect(summaries.text).toContain(`第3章：最近剧情${"最新情节".repeat(20)}`);
    expect(result.tokens).toBeLessThanOrEqual(budget);
  });
});
