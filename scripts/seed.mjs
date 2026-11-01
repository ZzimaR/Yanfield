#!/usr/bin/env node
/**
 * pnpm db:seed —— 重置示例数据（不删除你自己的作品）
 *
 * 做的事：
 *  1. 删除示例作品（按 author = 砚田示例，或旧标题《长夜行》、现标题《潮信》识别）；
 *  2. 删除内置提示词预设（is_builtin = 1），下次启动会由 ensureBuiltinPresets() 重建；
 *  3. 保留你的自建作品、自建预设、Provider 与设置。
 *
 * 之后重启 `pnpm dev`（或首次 API 请求）时，lib/seed.ts 的 ensureReady() 会重新写入示例作品。
 * 数据库路径与运行时一致：YANFIELD_DB_PATH，默认 <cwd>/data/yanfield.db
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const dbPath = process.env.YANFIELD_DB_PATH ?? path.join(process.cwd(), "data", "yanfield.db");

if (!fs.existsSync(dbPath)) {
  console.log(`[seed] 数据库不存在：${dbPath}`);
  console.log("[seed] 直接运行 pnpm dev，首次请求会自动创建数据库并写入示例作品。");
  process.exit(0);
}

const demoAuthor = "砚田示例";
const legacyTitle = "长夜行";
const demoTitle = "潮信";
let db;
try {
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");

  const novels = db
    .prepare("SELECT id, title FROM novels WHERE author = ? OR title = ? OR title = ?")
    .all(demoAuthor, legacyTitle, demoTitle);

  for (const novel of novels) {
    db.prepare("DELETE FROM novels WHERE id = ?").run(novel.id);
  }

  const deleted = novels.length;
  const presets = db.prepare("DELETE FROM prompt_presets WHERE is_builtin = 1").run();
  console.log(`[seed] 已删除示例作品 ${deleted} 部；重置内置预设 ${presets.changes} 条。`);
  console.log("[seed] 重启 pnpm dev（或任意一次 API 请求）后会自动重建示例作品与内置预设。");
} catch (err) {
  console.error("[seed] 失败：", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  db?.close();
}
