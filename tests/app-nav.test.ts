import { describe, expect, it } from "vitest";
import { novelBackTarget } from "@/lib/app-nav";

const novelId = "nov_1";

describe("novelBackTarget", () => {
  it("概览返回书架", () => {
    expect(novelBackTarget(`/novel/${novelId}`, novelId)).toEqual({ href: "/library", label: "返回书架" });
  });

  it("设定、大纲、档案返回概览", () => {
    expect(novelBackTarget(`/novel/${novelId}/bible`, novelId).href).toBe(`/novel/${novelId}`);
    expect(novelBackTarget(`/novel/${novelId}/outline`, novelId).label).toBe("返回概览");
    expect(novelBackTarget(`/novel/${novelId}/archives/`, novelId).href).toBe(`/novel/${novelId}`);
  });

  it("写作台返回概览", () => {
    expect(novelBackTarget(`/editor/${novelId}`, novelId)).toEqual({
      href: `/novel/${novelId}`,
      label: "返回概览",
    });
  });
});
