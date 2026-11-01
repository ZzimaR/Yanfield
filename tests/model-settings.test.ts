import { describe, expect, it } from "vitest";
import { unifyModelSettings } from "../lib/model-settings";

describe("unifyModelSettings", () => {
  it("两侧不一致时以 chat 为准", () => {
    const next = unifyModelSettings({
      chat: { providerId: "prov_a", model: "deepseek-chat" },
      prose: { providerId: "prov_b", model: "other" },
    });
    expect(next.chat).toEqual({ providerId: "prov_a", model: "deepseek-chat" });
    expect(next.prose).toEqual(next.chat);
  });

  it("只有 prose 时沿用 prose", () => {
    const next = unifyModelSettings({
      chat: { providerId: null, model: "" },
      prose: { providerId: "prov_b", model: "deepseek-chat" },
    });
    expect(next.chat.model).toBe("deepseek-chat");
    expect(next.prose).toEqual(next.chat);
  });
});
