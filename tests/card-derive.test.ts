import { describe, expect, it } from "vitest";
import { streamCompletion } from "@/lib/ai/provider";
import { parseCharacterFill, parseForeshadowFill } from "@/lib/ai/card-derive";
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

async function complete(user: string): Promise<string> {
  let text = "";
  for await (const chunk of streamCompletion({
    provider: demo,
    model: "yanfield-demo",
    messages: [{ role: "user", content: user }],
  })) {
    if (chunk.type === "delta") text += chunk.text;
  }
  return text;
}

describe("角色卡与伏笔卡", () => {
  it("补全角色卡不改成设定卡 JSON", async () => {
    const text = await complete("这是补全当前角色卡。\n\n姓名：\n顾衡");
    const fill = parseCharacterFill(text);
    expect(fill?.identity).toContain("顾衡");
    expect(fill?.personality).toContain("顾衡");
    expect(text).not.toContain("summary");
  });

  it("补全伏笔只返回说明和备注", async () => {
    const text = await complete("这是补全当前伏笔。\n\n标题：\n空白页");
    const fill = parseForeshadowFill(text);
    expect(fill?.description).toContain("空白页");
    expect(fill?.notes).toBeTruthy();
  });
});
