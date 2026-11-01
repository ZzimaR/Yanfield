import { describe, expect, it } from "vitest";
import { sameListOrderIndex } from "../lib/editor/reorder";

describe("sameListOrderIndex", () => {
  it("落回原位时不移动", () => {
    expect(sameListOrderIndex(1, 1)).toBeNull();
    expect(sameListOrderIndex(1, 2)).toBeNull();
  });

  it("向下拖到列表末尾", () => {
    expect(sameListOrderIndex(0, 3)).toBe(2);
  });

  it("向上拖到列表开头", () => {
    expect(sameListOrderIndex(2, 0)).toBe(0);
  });

  it("相邻互换", () => {
    expect(sameListOrderIndex(0, 2)).toBe(1);
    expect(sameListOrderIndex(1, 0)).toBe(0);
  });
});
