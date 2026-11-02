import { describe, expect, it } from "vitest";
import { streamCompletion } from "@/lib/ai/provider";
import { parseCardFill } from "@/lib/ai/world-derive";
import type { ProviderConfig } from "@/lib/types";

const demo: ProviderConfig = {
  id: "prov_demo",
  name: "演示",
  kind: "demo",
  baseUrl: "",
  apiKey: "",
  models: [{ id: "yanfield-demo", label: "演示" }],
  enabled: true,
  createdAt: "",
  updatedAt: "",
};

async function complete(system: string, user: string): Promise<string> {
  let text = "";
  for await (const chunk of streamCompletion({
    provider: demo,
    model: "yanfield-demo",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  })) {
    if (chunk.type === "delta") text += chunk.text;
  }
  return text;
}

describe("演示模型的设定卡", () => {
  it("补全当前卡片只返回这一张的摘要和正文", async () => {
    const text = await complete(
      "你是设定编辑。若任务是补全当前卡片，只输出 JSON。",
      "这是补全当前卡片。\n\n标题：\n澜国",
    );
    const fill = parseCardFill(text);
    expect(fill?.summary).toContain("澜国");
    expect(fill?.content).toContain("澜国");
    expect(text).not.toContain("chapterSummary");
  });

  it("故事档案仍然返回档案 JSON", async () => {
    const text = await complete("你是故事档案员。输出严格 JSON。", "请输出档案 JSON。");
    expect(text).toContain("chapterSummary");
  });
});
