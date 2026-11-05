import { describe, expect, it } from "vitest";
import { streamCompletion } from "@/lib/ai/provider";
import {
  CODEX_CONTEXT_LIMIT,
  buildCodexUserPrompt,
  codexParentId,
  orderedCodexItems,
  parseCodexReply,
  prepareCodexItems,
  setCodexPicked,
  type CodexItem,
} from "@/lib/ai/codex";
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

describe("资料助手", () => {
  it("把州挂到国下，城挂到州下，邻国不挂，人单独成卡", async () => {
    const text = await complete("这是资料整理。\n\n澜国西面临海。临波州。青阳城。朔国相邻。陆衡。");
    const reply = parseCodexReply(text);
    const items = prepareCodexItems(reply?.items ?? [], []);
    const byTitle = new Map(items.map((item) => [item.title, item]));
    expect(byTitle.get("临波州")?.parentRef).toBe(byTitle.get("澜国")?.ref);
    expect(byTitle.get("青阳城")?.parentRef).toBe(byTitle.get("临波州")?.ref);
    expect(byTitle.get("朔国")?.parentRef).toBeNull();
    expect(byTitle.get("陆衡")?.kind).toBe("character");
    expect(orderedCodexItems(items).map((item) => item.title)).toEqual(["澜国", "临波州", "青阳城", "朔国", "陆衡"]);
  });

  it("同名已有卡改为更新，父级写成标题时改成 ref", () => {
    const parsed = parseCodexReply(
      JSON.stringify({
        message: "补一张城",
        items: [
          { ref: "city", kind: "world", title: "青阳城", parentRef: "澜国", relation: "位于", category: "地理" },
          { ref: "shuo", kind: "world", title: "朔国", parentRef: "lan", relation: "相邻" },
        ],
      }),
    );
    const items = prepareCodexItems(parsed?.items ?? [], [{ id: "world_lan", kind: "world", title: "澜国" }]);
    expect(items.find((item) => item.title === "青阳城")).toMatchObject({
      parentRef: "world_lan",
      category: "geography",
      op: "create",
    });
    expect(items.find((item) => item.title === "朔国")?.parentRef).toBeNull();
    const withCountry = prepareCodexItems(
      [
        ...(parsed?.items ?? []),
        { ...(parsed?.items[0] as CodexItem), ref: "lan", title: "澜国", parentRef: null, relation: "" },
      ],
      [{ id: "world_lan", kind: "world", title: "澜国" }],
    );
    expect(withCountry.find((item) => item.title === "澜国")).toMatchObject({ op: "update", id: "world_lan" });
  });

  it("取消父卡时子卡一起取消，父级 id 在写入时能解析", () => {
    const items = prepareCodexItems(
      parseCodexReply(
        JSON.stringify({
          message: "两张",
          items: [
            { ref: "lan", kind: "world", title: "澜国", relation: "" },
            { ref: "zhou", kind: "world", title: "临波州", parentRef: "lan", relation: "位于" },
          ],
        }),
      )?.items ?? [],
      [],
    );
    const unchecked = setCodexPicked(items, "lan", false);
    expect(unchecked.every((item) => item.picked === false)).toBe(true);
    const ids = new Map<string, string>([["lan", "world_lan"]]);
    const child = items.find((item) => item.ref === "zhou");
    expect(child && codexParentId(child, ids)).toBe("world_lan");
  });

  it("解析伏笔条目：标题、埋法、提醒都映射到卡片字段", () => {
    const parsed = parseCodexReply(
      JSON.stringify({
        message: "留了两条线",
        items: [
          {
            ref: "jade",
            kind: "foreshadow",
            title: "旧玉佩",
            description: "澜国夫人遗物，后文认亲的凭据",
            notes: "第三章之前别解释来历",
            status: "planted",
          },
          { ref: "seal", kind: "伏笔", title: "半枚铜印", status: "已埋设" },
        ],
      }),
    );
    expect(parsed?.items[0]).toMatchObject({
      ref: "jade",
      kind: "foreshadow",
      title: "旧玉佩",
      description: "澜国夫人遗物，后文认亲的凭据",
      notes: "第三章之前别解释来历",
      status: "planted",
    });
    expect(parsed?.items[1]).toMatchObject({ kind: "foreshadow", title: "半枚铜印", status: "planted" });
  });

  it("同名伏笔对已有卡改为更新", () => {
    const items = prepareCodexItems(
      parseCodexReply(
        JSON.stringify({
          message: "补一条伏笔",
          items: [{ ref: "jade", kind: "foreshadow", title: "旧玉佩", notes: "第四章回收" }],
        }),
      )?.items ?? [],
      [{ id: "fore_jade", kind: "foreshadow", title: "旧玉佩" }],
    );
    expect(items[0]).toMatchObject({ op: "update", id: "fore_jade", notes: "第四章回收" });
  });

  it("带上一份清单追问时，提示词里能看到清单", () => {
    const draft = prepareCodexItems(
      parseCodexReply(
        JSON.stringify({ message: "", items: [{ ref: "zhen", kind: "world", title: "禾镇", category: "geography" }] }),
      )?.items ?? [],
      [],
    );
    const prompt = buildCodexUserPrompt({
      catalog: "世界：\n- id=world_lan title=澜国 category=faction\n角色：\n（无）\n伏笔：\n（无）",
      history: [{ role: "user", content: "澜国西面临海" }],
      draft,
      message: "白石镇先别建",
    });
    expect(prompt).toContain("【上一份待写入清单】");
    expect(prompt).toContain("禾镇");
    expect(prompt).toContain("作者：澜国西面临海");
    expect(prompt).toContain("【作者这次说】\n白石镇先别建");

    const fresh = buildCodexUserPrompt({ catalog: "（无）", history: [], draft: [], message: "这是一段新材料" });
    expect(fresh).toContain("【上一份待写入清单】\n（无）");
    expect(fresh).toContain("【对话】\n（无）");
  });

  it("含伏笔时按世界、角色、伏笔的顺序写入", () => {
    const items = prepareCodexItems(
      parseCodexReply(
        JSON.stringify({
          message: "三张卡",
          items: [
            { ref: "jade", kind: "foreshadow", title: "旧玉佩" },
            { ref: "lu", kind: "character", title: "陆衡", role: "supporting" },
            { ref: "lan", kind: "world", title: "澜国" },
          ],
        }),
      )?.items ?? [],
      [],
    );
    const ordered = orderedCodexItems(items);
    expect(ordered.map((item) => item.kind)).toEqual(["world", "character", "foreshadow"]);
    expect(ordered.map((item) => item.title)).toEqual(["澜国", "陆衡", "旧玉佩"]);
    expect(orderedCodexItems(setCodexPicked(items, "jade", false)).map((item) => item.title)).toEqual(["澜国", "陆衡"]);
  });

  it("带正文节选时提示词里能看到【当前章节正文节选】", () => {
    const contextText = "陆衡推门进来，手里攥着半枚铜印，屋里一时没人说话。";
    const prompt = buildCodexUserPrompt({
      catalog: "（无）",
      history: [],
      draft: [],
      message: "从这段正文里把出场人物和铜印衍生成卡片",
      contextText,
    });
    expect(prompt).toContain("【当前章节正文节选】");
    expect(prompt).toContain(contextText);
    // 正文段必须在【对话】之前：模型先读正文，再看对话和这次的问题
    expect(prompt.indexOf("【当前章节正文节选】")).toBeLessThan(prompt.indexOf("【对话】"));
  });

  it("没有正文节选时提示词里不出现正文段，过长节选会被截断", () => {
    const fresh = buildCodexUserPrompt({ catalog: "（无）", history: [], draft: [], message: "这是一段新材料" });
    expect(fresh).not.toContain("【当前章节正文节选】");

    const long = "澜".repeat(CODEX_CONTEXT_LIMIT + 500);
    const prompt = buildCodexUserPrompt({
      catalog: "（无）",
      history: [],
      draft: [],
      message: "从正文里拆卡片",
      contextText: long,
    });
    expect(prompt).toContain("（已截断）");
    expect(prompt).toContain("澜".repeat(CODEX_CONTEXT_LIMIT));
    expect(prompt).not.toContain(long);
  });
});
