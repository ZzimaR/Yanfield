import { describe, expect, it } from "vitest";
import {
  DEFAULT_HISTORY_CHARS,
  DEFAULT_HISTORY_MESSAGES,
  trimChatHistory,
} from "@/lib/ai/history";

function turns(count: number, content = "内容"): { role: string; content: string }[] {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `${content}${index}`,
  }));
}

describe("对话历史压缩", () => {
  it("未超限时原样保留", () => {
    const messages = turns(4);
    const result = trimChatHistory(messages);
    expect(result.kept).toEqual(messages);
    expect(result.trimmed).toBe(false);
    expect(result.dropped).toBe(0);
  });

  it("超过条数上限时只保留最近的消息", () => {
    const messages = turns(DEFAULT_HISTORY_MESSAGES + 5);
    const result = trimChatHistory(messages);
    expect(result.kept).toHaveLength(DEFAULT_HISTORY_MESSAGES);
    expect(result.kept[0]).toEqual(messages[5]);
    expect(result.kept.at(-1)).toEqual(messages.at(-1));
    expect(result.trimmed).toBe(true);
    expect(result.dropped).toBe(5);
  });

  it("超过字符预算时从最早的消息开始丢", () => {
    const messages = [
      { role: "user", content: "a".repeat(10) },
      { role: "assistant", content: "b".repeat(10) },
      { role: "user", content: "c".repeat(10) },
    ];
    const result = trimChatHistory(messages, { maxMessages: 10, maxChars: 25 });
    // 从最新往前：c(10) + b(10) = 20 ≤ 25 保留；再加 a(10) 会超预算 → 丢掉最早的 a
    expect(result.kept).toHaveLength(2);
    expect(result.kept[0].content.startsWith("b")).toBe(true);
    expect(result.kept[1].content.startsWith("c")).toBe(true);
    expect(result.trimmed).toBe(true);
    expect(result.chars).toBe(20);
  });

  it("单条消息就超过预算时也至少保留最新一条", () => {
    const messages = [
      { role: "user", content: "x" },
      { role: "assistant", content: "y".repeat(DEFAULT_HISTORY_CHARS + 100) },
    ];
    const result = trimChatHistory(messages);
    expect(result.kept).toHaveLength(1);
    expect(result.kept[0].role).toBe("assistant");
    expect(result.chars).toBeLessThanOrEqual(DEFAULT_HISTORY_CHARS);
    expect(result.kept[0].content).toContain("因预算省略");
  });

  it("预算边界刚好放下时全部保留", () => {
    const messages = turns(3, "abcd"); // 每条 "abcd" + 序号 = 5 字符，共 15
    const result = trimChatHistory(messages, { maxMessages: 10, maxChars: 15 });
    expect(result.kept).toHaveLength(3);
    expect(result.trimmed).toBe(false);
  });

  it("maxMessages 至少为 1", () => {
    const messages = turns(3);
    const result = trimChatHistory(messages, { maxMessages: 0 });
    expect(result.kept).toHaveLength(1);
  });
});
