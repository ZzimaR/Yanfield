#!/usr/bin/env node
/**
 * pnpm db:seed —— 删除匹配示例标识的作品与内置预设
 *
 * 做的事：
 *  1. 删除作者为「砚田示例」或标题为《长夜行》《潮信》的作品（同名自建作品也会删除）；
 *  2. 删除内置提示词预设（is_builtin = 1），下次启动会由 ensureBuiltinPresets() 重建；
 *  3. 保留不符合上述条件的作品、自建预设、Provider 与设置；内置预设中的改动可能丢失。
 *
 * 重新启动后只有数据库没有任何作品时才自动写入示例作品。执行前请停服并备份数据库。
 * 数据库路径与运行时一致：YANFIELD_DB_PATH，默认在系统用户数据目录（见 lib/db/data-path.mjs）
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { resolveDbPath } from "../lib/db/data-path.mjs";

const dbPath = resolveDbPath();

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
  console.log(`[seed] 已删除符合示例作者或标题的作品 ${deleted} 部；重置内置预设 ${presets.changes} 条。`);
  console.log("[seed] 启动后会重建内置预设；仅当数据库没有任何作品时才自动创建示例作品。");
} catch (err) {
  console.error("[seed] 失败：", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  db?.close();
}
