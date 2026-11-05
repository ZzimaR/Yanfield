import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const folder = mkdtempSync(join(tmpdir(), "yanfield-schema-"));
const previousDbPath = process.env.YANFIELD_DB_PATH;
let db: typeof import("@/lib/db") | null = null;

async function openDb(file: string) {
  process.env.YANFIELD_DB_PATH = file;
  vi.resetModules();
  db = await import("@/lib/db");
  return db;
}

function userVersion(file: string): number {
  const raw = new DatabaseSync(file);
  try {
    return Number((raw.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
  } finally {
    raw.close();
  }
}

beforeEach(() => {
  db = null;
});

afterEach(() => {
  try {
    db?.getDb().close();
  } catch {
    /* 打开失败的用例没有可关闭的连接 */
  }
});

afterAll(() => {
  if (previousDbPath === undefined) delete process.env.YANFIELD_DB_PATH;
  else process.env.YANFIELD_DB_PATH = previousDbPath;
  rmSync(folder, { recursive: true, force: true });
});

describe("数据库结构版本", () => {
  it("新库直接写入当前版本号", async () => {
    const file = join(folder, "fresh.db");
    const mod = await openDb(file);
    mod.getDb();
    expect(mod.getDbPath()).toBe(file);
    mod.getDb().close();
    expect(userVersion(file)).toBe(mod.SCHEMA_VERSION);
  });

  it("版本化之前的开发期旧库会补齐缺失列并升级版本号", async () => {
    const file = join(folder, "legacy.db");
    const legacy = new DatabaseSync(file);
    const schema = readFileSync("lib/db/index.ts", "utf8").match(/CREATE TABLE IF NOT EXISTS world_settings \([\s\S]*?\n\);/)![0];
    legacy.exec(schema.replace(/^\s*importance .*\n/m, ""));
    legacy.close();

    const mod = await openDb(file);
    const columns = (mod.getDb().prepare("PRAGMA table_info(world_settings)").all() as { name: string }[]).map((c) => c.name);
    expect(columns).toContain("importance");
    const logColumns = (mod.getDb().prepare("PRAGMA table_info(ai_logs)").all() as { name: string }[]).map((c) => c.name);
    expect(logColumns).toEqual(expect.arrayContaining(["cached_input_tokens", "cache_reported_input_tokens"]));
    mod.getDb().close();
    expect(userVersion(file)).toBe(mod.SCHEMA_VERSION);
  });

  it("拒绝打开由更新版本升级过的数据库，且不改动它", async () => {
    const file = join(folder, "future.db");
    const future = new DatabaseSync(file);
    future.exec("PRAGMA user_version = 999");
    future.close();

    const mod = await openDb(file);
    expect(() => mod.getDb()).toThrow(/高于当前程序支持/);
    db = null;
    expect(userVersion(file)).toBe(999);
  });
});
