import { describe, expect, it } from "vitest";
import { parseCardFill } from "@/lib/ai/world-derive";

describe("parseCardFill", () => {
  it("只取摘要和正文", () => {
    const fill = parseCardFill('说明\n{"summary":"西面临海","content":"京城距海三百里"}');
    expect(fill).toEqual({ summary: "西面临海", content: "京城距海三百里" });
  });

  it("没有这两段就放弃", () => {
    expect(parseCardFill("待确认：人口是多少？")).toBeNull();
  });
});
