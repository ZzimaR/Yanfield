import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const folder = mkdtempSync(join(tmpdir(), "yanfield-chat-page-"));
let repo: typeof import("@/lib/repo"), db: typeof import("@/lib/db");
let sessionId: string;

beforeAll(async () => {
  process.env.YANFIELD_DB_PATH = join(folder, "test.db");
  repo = await import("@/lib/repo");
  db = await import("@/lib/db");
  const novel = repo.createNovel({ title: "消息分页测试" });
  const session = repo.createChatSession(novel.id);
  sessionId = session.id;
  for (let index = 0; index < 5; index += 1) {
    repo.addMessage(sessionId, { role: index % 2 ? "assistant" : "user", content: `消息${index}` });
  }
});

afterAll(() => {
  db.getDb().close();
  delete process.env.YANFIELD_DB_PATH;
  rmSync(folder, { recursive: true, force: true });
});

describe("chat message pagination", () => {
  it("loads newest messages first and walks older messages without overlap", () => {
    const newest = repo.listMessagesPage(sessionId, null, 2)!;
    expect(newest.items.map((message) => message.content)).toEqual(["消息3", "消息4"]);
    expect(newest.hasMore).toBe(true);

    const older = repo.listMessagesPage(sessionId, newest.beforeId, 2)!;
    expect(older.items.map((message) => message.content)).toEqual(["消息1", "消息2"]);
    expect(older.hasMore).toBe(true);

    const oldest = repo.listMessagesPage(sessionId, older.beforeId, 2)!;
    expect(oldest.items.map((message) => message.content)).toEqual(["消息0"]);
    expect(oldest.hasMore).toBe(false);
  });

  it("rejects a cursor from another session", () => {
    const other = repo.createChatSession(repo.getChatSession(sessionId)!.novelId);
    const otherMessage = repo.addMessage(other.id, { role: "user", content: "other" });
    expect(repo.listMessagesPage(sessionId, otherMessage.id, 2)).toBeNull();
    expect(repo.deleteMessage(sessionId, otherMessage.id)).toBe(false);
    expect(repo.deleteMessage(other.id, otherMessage.id)).toBe(true);
    expect(repo.listMessages(other.id)).toHaveLength(0);
  });
});
