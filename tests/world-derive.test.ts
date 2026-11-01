import { describe, expect, it } from "vitest";
import { parseCardFill, parseDerivedSettings } from "@/lib/ai/world-derive";

describe("parseCardFill", () => {
  it("只取摘要和正文", () => {
    const fill = parseCardFill('说明\n{"summary":"西面临海","content":"京城距海三百里"}');
    expect(fill).toEqual({ summary: "西面临海", content: "京城距海三百里" });
  });

  it("没有这两段就放弃", () => {
    expect(parseCardFill("待确认：人口是多少？")).toBeNull();
  });
});

describe("parseDerivedSettings", () => {
  it("包含关系挂到当前卡片下，其余只记关系", () => {
    const items = parseDerivedSettings(
      JSON.stringify({
        items: [
          { title: "青阳城", category: "地理", summary: "京城", content: "距海三百里", relation: "位于" },
          { title: "朔国", category: "势力", summary: "南邻", content: "出关后的国家", relation: "相邻" },
          { title: "青阳城", category: "geography", summary: "重复", content: "", relation: "位于" },
        ],
      }),
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ title: "青阳城", category: "geography", nest: true });
    expect(items[1]).toMatchObject({ title: "朔国", category: "faction", nest: false });
  });
});
