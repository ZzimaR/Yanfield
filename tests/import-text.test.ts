import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_IMPORT_CHAPTERS, splitChapters } from "@/app/api/_lib/text";

function numberedChapters(count: number): string {
  return Array.from({ length: count }, (_, index) =>
    `第${index + 1}章 标题\n正文-${index + 1}`,
  ).join("\n\n");
}

describe("TXT 拆章数量边界", () => {
  it("不含前言时允许完整导入 2000 章", () => {
    const chapters = splitChapters(numberedChapters(MAX_IMPORT_CHAPTERS));
    expect(chapters).toHaveLength(MAX_IMPORT_CHAPTERS);
    expect(chapters.at(-1)?.content).toBe("正文-2000");
  });

  it("前言计入上限，允许前言加 1999 章", () => {
    const chapters = splitChapters(`前言内容\n\n${numberedChapters(MAX_IMPORT_CHAPTERS - 1)}`);
    expect(chapters).toHaveLength(MAX_IMPORT_CHAPTERS);
    expect(chapters[0]).toEqual({ title: "前言", content: "前言内容" });
    expect(chapters.at(-1)?.content).toBe("正文-1999");
  });

  it("前言加 2000 章时明确报错，不静默丢弃最后一章", () => {
    expect(() => splitChapters(`前言内容\n\n${numberedChapters(MAX_IMPORT_CHAPTERS)}`))
      .toThrow(/超过上限.*含前言/);
  });

  it("超过 2000 个标题时明确报错，而不是合并后续章节", () => {
    expect(() => splitChapters(numberedChapters(MAX_IMPORT_CHAPTERS + 1)))
      .toThrow(/超过上限/);
  });

  it("空匹配过多的自定义正则不会悄悄截断", () => {
    expect(() => splitChapters("a".repeat(20001), "(?=a)")).toThrow("章节分割次数过多");
  });
});

describe("TXT 导入接口", () => {
  const folder = mkdtempSync(join(tmpdir(), "yanfield-import-test-"));
  const dbPath = join(folder, "test.db");
  const previousDbPath = process.env.YANFIELD_DB_PATH;
  let route: typeof import("@/app/api/import/txt/route");
  let db: typeof import("@/lib/db");

  beforeAll(async () => {
    process.env.YANFIELD_DB_PATH = dbPath;
    route = await import("@/app/api/import/txt/route");
    db = await import("@/lib/db");
  });

  afterAll(() => {
    db.getDb().close();
    if (previousDbPath === undefined) delete process.env.YANFIELD_DB_PATH;
    else process.env.YANFIELD_DB_PATH = previousDbPath;
    for (const suffix of ["", "-wal", "-shm", "-journal"]) rmSync(dbPath + suffix, { force: true });
    rmdirSync(folder);
  });

  it("超限时返回 400 和明确提示", async () => {
    const form = new FormData();
    form.append("file", new File([`前言内容\n\n${numberedChapters(MAX_IMPORT_CHAPTERS)}`], "book.txt"));
    const response = await route.POST(
      new Request("http://localhost/api/import/txt", { method: "POST", body: form }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("超过上限") });
  });
});
