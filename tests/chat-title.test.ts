import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chatTitleFromMessage } from "@/lib/chat-title";

const folder = mkdtempSync(join(tmpdir(), "yanfield-title-"));
let repo: typeof import("@/lib/repo"), db: typeof import("@/lib/db");
let novelId: string;
beforeAll(async () => {
  process.env.YANFIELD_DB_PATH = join(folder, "test.db");
  repo = await import("@/lib/repo"); db = await import("@/lib/db");
  novelId = repo.createNovel({ title: "会话与长篇回归" }).id;
});
afterAll(() => { db.getDb().close(); delete process.env.YANFIELD_DB_PATH; rmSync(folder, { recursive: true, force: true }); });

describe("会话自动标题", () => {
  it("合并换行，按 Unicode 字符截断", () => {
    expect(chatTitleFromMessage("  续写下一章\n保留悬念  ")).toBe("续写下一章 保留悬念");
    expect(chatTitleFromMessage("😀".repeat(25))).toBe("😀".repeat(24) + "…");
  });
  it("空会话保留新对话，第一条提问命名，后续提问不覆盖", () => {
    const session = repo.createChatSession(novelId);
    expect(repo.getChatSession(session.id)?.title).toBe("新对话");
    repo.addMessage(session.id, { role: "assistant", content: "欢迎" });
    repo.addMessage(session.id, { role: "user", content: "  整理周晚的人物资料  " });
    repo.addMessage(session.id, { role: "user", content: "再续写下一章" });
    expect(repo.getChatSession(session.id)?.title).toBe("整理周晚的人物资料");
    expect(db.get<{title:string}>("SELECT title FROM chat_sessions WHERE id=?", [session.id])?.title).toBe("整理周晚的人物资料");
  });
  it("旧记录从首条提问补标题，不改变时间或自定义标题", () => {
    const session = repo.createChatSession(novelId);
    repo.addMessage(session.id, { role: "user", content: "重写退潮这一章" });
    db.run("UPDATE chat_sessions SET title='新对话' WHERE id=?", [session.id]);
    const before = repo.getChatSession(session.id)!;
    expect(repo.listChatSessions(novelId).find(s => s.id === session.id)?.title).toBe("重写退潮这一章");
    expect(repo.getChatSession(session.id)?.updatedAt).toBe(before.updatedAt);
    repo.updateChatSession(session.id, { title: "我的修订记录" });
    repo.addMessage(session.id, { role: "user", content: "其他问题" });
    expect(repo.getChatSession(session.id)?.title).toBe("我的修订记录");
  });
});

describe("长篇章节目录投影", () => {
  it("摘要列表和树不含正文，单章与默认读取仍完整，卷归属不变", () => {
    const volume = repo.createVolume(novelId, { title: "第一卷" });
    const body = "<p>潮水退去。" + "长篇正文".repeat(25000) + "</p>";
    const chapter = repo.createChapter(novelId, { title: "第一章", volumeId: volume.id, content: body });
    const loose = repo.createChapter(novelId, { title: "第二章", content: body });
    expect(repo.listChapters(novelId, false).every(c => c.content === "")).toBe(true);
    const tree = repo.getNovelTree(novelId, false)!;
    expect(tree.volumes[0].chapters[0].id).toBe(chapter.id);
    expect(tree.looseChapters[0].id).toBe(loose.id);
    expect(JSON.stringify(tree).length).toBeLessThan(3000);
    expect(repo.getChapter(chapter.id)?.content).toBe(body);
    expect(repo.getNovelTree(novelId)!.volumes[0].chapters[0].content).toBe(body);
  });
});
