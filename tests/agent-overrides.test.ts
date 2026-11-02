import { describe, expect, it } from "vitest";
import { AGENTS, DEFAULT_APP_SETTINGS, applyAgentOverride, type AppSettings } from "@/lib/types";
import { agentPreamble } from "@/lib/ai/prompts";
import { buildSettingsPatch } from "@/app/api/_lib/settings";

const supervisor = AGENTS.find((agent) => agent.id === "supervisor");
if (!supervisor) throw new Error("测试前提：AGENTS 里需要保留主编（supervisor）");

function settingsWith(patch: Partial<AppSettings>): AppSettings {
  return { ...DEFAULT_APP_SETTINGS, ...patch };
}

describe("智能体人设覆盖", () => {
  it("默认设置不带任何覆盖", () => {
    expect(DEFAULT_APP_SETTINGS.agentOverrides).toEqual({});
    expect(applyAgentOverride(supervisor)).toBe(supervisor);
    expect(applyAgentOverride(supervisor, {})).toBe(supervisor);
  });

  it("覆盖名称/职责/说明/问候语，保留头像与强项", () => {
    const overridden = applyAgentOverride(supervisor, {
      name: "总编辑",
      role: "统筹全书进度",
      description: "只给可执行的改动清单。",
      greeting: "今天写哪一章？",
    });
    expect(overridden.name).toBe("总编辑");
    expect(overridden.role).toBe("统筹全书进度");
    expect(overridden.description).toBe("只给可执行的改动清单。");
    expect(overridden.greeting).toBe("今天写哪一章？");
    expect(overridden.skills).toBe(supervisor.skills);
    expect(overridden.tint).toBe(supervisor.tint);
    expect(overridden.modelRole).toBe(supervisor.modelRole);
  });

  it("空字符串与纯空白按未覆盖处理", () => {
    expect(applyAgentOverride(supervisor, { name: "  ", role: "", description: undefined })).toBe(supervisor);
  });

  it("额外要求作为最后一行附在提示词末尾", () => {
    const preamble = agentPreamble(
      "supervisor",
      settingsWith({
        agentOverrides: { supervisor: { name: "总编辑", instructions: "每段不超过三行。" } },
      }),
    );
    const lines = preamble.split("\n");
    expect(preamble).toContain("现在由「总编辑」");
    expect(preamble).toContain("强项：");
    expect(lines[lines.length - 1]).toBe("额外要求：每段不超过三行。");
  });

  it("自定义智能体应用 customAgent 与额外要求", () => {
    const preamble = agentPreamble(
      "custom",
      settingsWith({
        customAgent: { name: "责编", role: "只看逻辑", persona: "直接指出问题，不夸人。", greeting: "稿子呢？" },
        agentOverrides: { custom: { instructions: "先说结论，再列依据。" } },
      }),
    );
    expect(preamble).toContain("现在由作者的「责编」协助创作");
    expect(preamble).toContain("定位：只看逻辑");
    expect(preamble).toContain("人设与工作方式：直接指出问题，不夸人。");
    expect(preamble.split("\n").at(-1)).toBe("额外要求：先说结论，再列依据。");
  });

  it("已精简的旧智能体 id 回落到主编的人设与覆盖", () => {
    const settings = settingsWith({ agentOverrides: { supervisor: { name: "总编辑" } } });
    const preamble = agentPreamble("blueprint", settings);
    expect(preamble).toContain("现在由「总编辑」");
  });
});

describe("PATCH /api/settings 的人设覆盖清洗", () => {
  it("trim 后限长 500，空字符串表示删除字段", () => {
    const patch = buildSettingsPatch(DEFAULT_APP_SETTINGS, {
      agentOverrides: {
        supervisor: { name: "  总编辑  ", instructions: "长".repeat(600) },
        writer: { role: "" },
      },
    });
    expect(patch.agentOverrides?.supervisor?.name).toBe("总编辑");
    expect(patch.agentOverrides?.supervisor?.instructions?.length).toBe(500);
    expect(patch.agentOverrides?.writer).toBeUndefined();
  });

  it("按智能体深合并，保留没提交的覆盖", () => {
    const current: AppSettings = settingsWith({
      agentOverrides: { supervisor: { name: "总编辑", instructions: "短句。" }, setting: { role: "资料" } },
    });
    const patch = buildSettingsPatch(current, { agentOverrides: { supervisor: { greeting: "今天写哪章？" } } });
    expect(patch.agentOverrides?.supervisor).toEqual({ name: "总编辑", instructions: "短句。", greeting: "今天写哪章？" });
    expect(patch.agentOverrides?.setting).toEqual({ role: "资料" });
  });

  it("拒绝未注册的智能体 id、非字符串字段与非法结构", () => {
    expect(() => buildSettingsPatch(DEFAULT_APP_SETTINGS, { agentOverrides: { blueprint: { name: "x" } } })).toThrow(
      "不是有效的智能体 id",
    );
    expect(() => buildSettingsPatch(DEFAULT_APP_SETTINGS, { agentOverrides: { supervisor: { name: 1 } } })).toThrow(
      "必须是字符串",
    );
    expect(() => buildSettingsPatch(DEFAULT_APP_SETTINGS, { agentOverrides: "x" })).toThrow("agentOverrides 必须是对象");
  });
});
