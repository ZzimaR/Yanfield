import {beforeAll,afterAll,describe,it,expect} from "vitest";
import {DatabaseSync} from "node:sqlite";
import {mkdtempSync,readFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const folder=mkdtempSync(join(tmpdir(),"yanfield-cache-"));
let repo:typeof import("@/lib/repo"),db:typeof import("@/lib/db");
beforeAll(async()=>{
 const file=join(folder,"test.db"),legacy=new DatabaseSync(file);
 const schema=readFileSync("lib/db/index.ts","utf8").match(/CREATE TABLE IF NOT EXISTS ai_logs \([\s\S]*?\);/)![0];
 legacy.exec(schema);legacy.prepare("INSERT INTO ai_logs(id,feature,prompt_tokens,created_at) VALUES(?,?,?,?)").run("old","chat",100,new Date().toISOString());legacy.close();
 process.env.YANFIELD_DB_PATH=file;repo=await import("@/lib/repo");db=await import("@/lib/db");
});
afterAll(()=>{db.getDb().close();delete process.env.YANFIELD_DB_PATH;rmSync(folder,{recursive:true,force:true});});
describe("缓存计量旧库迁移",()=>{
 it("旧账单输入保留未知，新缓存统计可累计和读取",()=>{
  const before=repo.getStats();expect(before.aiPromptTokens).toBe(100);expect(before.aiCacheReportedInputTokens).toBe(0);
  repo.addAiLog({feature:"chat",provider:"test",model:"test",promptTokens:20,completionTokens:2,cachedInputTokens:15,cacheReportedInputTokens:20});
  const after=repo.getStats();expect(after.aiPromptTokens).toBe(120);expect(after.aiCachedInputTokens).toBe(15);expect(after.aiCacheReportedInputTokens).toBe(20);
  expect(after.todayCachedInputTokens).toBe(15);expect(repo.listAiLogs().find(r=>r.id!=="old")?.cachedInputTokens).toBe(15);
 });
});
