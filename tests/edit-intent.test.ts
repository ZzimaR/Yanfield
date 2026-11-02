import { describe, expect, it } from "vitest";

import { detectEditIntent } from "@/components/ai/edit-intent";

describe("对话栏改稿意图识别", () => {
  it("识别扩写", () => {
    const intent = detectEditIntent("帮我改一下这章，然后扩写一下");
    expect(intent?.feature).toBe("expand");
    expect(intent?.needsSelection).toBe(true);
  });

  it("识别续写（不需要选区）", () => {
    const intent = detectEditIntent("接着往下写，续写这章");
    expect(intent?.feature).toBe("continue");
    expect(intent?.needsSelection).toBe(false);
  });

  it("识别润色", () => {
    expect(detectEditIntent("帮我把这段润色一下")?.feature).toBe("polish");
  });

  it("识别去 AI 味", () => {
    expect(detectEditIntent("这一段去一下 AI 味")?.feature).toBe("deai");
  });

  it("识别改写", () => {
    expect(detectEditIntent("改一下这章，换个视角写")?.feature).toBe("rewrite");
  });

  it("短命令也能命中", () => {
    expect(detectEditIntent("续写")?.feature).toBe("continue");
    expect(detectEditIntent("扩写一下")?.feature).toBe("expand");
  });

  it("普通提问不当成改稿", () => {
    expect(detectEditIntent("这段能怎么写更好？")).toBeNull();
    expect(detectEditIntent("你觉得小满这个角色怎么样？")).toBeNull();
    expect(detectEditIntent("帮我看看这一章的节奏有没有问题")).toBeNull();
  });

  it("长句且没有指代当前正文时不当成改稿", () => {
    expect(
      detectEditIntent("我想让周晚在结尾的时候突然意识到账本被人换过了，这样写会不会太突然，你觉得呢？"),
    ).toBeNull();
  });

  it("空字符串返回 null", () => {
    expect(detectEditIntent("  ")).toBeNull();
  });
});
