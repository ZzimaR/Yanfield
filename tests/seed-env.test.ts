/**
 * 环境变量自动接入模型服务：
 * 用临时 SQLite 数据库模拟「Docker / 自托管部署只给了 DEEPSEEK_API_KEY」的场景，
 * 验证首次启动会创建 Provider、并自动把默认模型从演示模式切到真实服务。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "yantian-seed-"));
const dbPath = join(dir, "env.db");

type SeedModule = typeof import("../lib/seed");
type RepoModule = typeof import("../lib/repo");

describe("环境变量自动接入模型服务", () => {
  let seed: SeedModule;
  let repo: RepoModule;

  beforeAll(async () => {
    process.env.YANFIELD_DB_PATH = dbPath;
    process.env.DEEPSEEK_API_KEY = "sk-test-deepseek";
    for (const key of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DASHSCOPE_API_KEY", "MOONSHOT_API_KEY"]) {
      delete process.env[key];
    }
    seed = await import("../lib/seed");
    repo = await import("../lib/repo");
    seed.ensureReady();
  });

  afterAll(async () => {
    try {
      const dbModule = await import("../lib/db");
      dbModule.getDb().close();
    } catch {
      /* 关不掉也不影响测试结果 */
    }
    delete process.env.YANFIELD_DB_PATH;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows 下文件可能仍被占用 */
    }
  });

  it("创建了 DeepSeek 服务并把默认模型切过去", () => {
    const deepseek = repo.listProviders().find((provider) => provider.name === "DeepSeek");
    expect(deepseek).toBeTruthy();
    expect(deepseek?.kind).toBe("openai");
    expect(deepseek?.baseUrl).toContain("api.deepseek.com");
    expect(deepseek?.apiKey).toBe("sk-test-deepseek");
    expect(deepseek?.enabled).toBe(true);
    expect(deepseek?.models.map((model) => model.id)).toContain("deepseek-chat");

    const settings = repo.getSettings();
    expect(settings.models.chat.providerId).toBe(deepseek?.id);
    expect(settings.models.chat.model).toBe("deepseek-chat");
    expect(settings.models.prose.providerId).toBe(deepseek?.id);
  });

  it("保留离线演示 Provider 作为无 Key 兜底", () => {
    const demo = repo.listProviders().find((provider) => provider.kind === "demo");
    expect(demo).toBeTruthy();
    expect(demo?.models.length).toBeGreaterThanOrEqual(2);
  });

  it("默认上下文预算来自设置（12000，可改）", () => {
    const settings = repo.getSettings();
    expect(settings.defaultContext.contextBudget).toBe(12000);
  });
});
