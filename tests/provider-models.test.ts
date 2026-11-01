/**
 * 模型列表拉取测试：用本地 HTTP 服务模拟各家的 /models 响应，
 * 验证 listProviderModels 的真实请求路径、解析与错误中文化。
 */
import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { listProviderModels, ProviderError } from "../lib/ai/provider";
import type { ProviderConfig, ProviderKind } from "../lib/types";

let server: Server | null = null;

function listen(handler: (url: string, res: import("node:http").ServerResponse) => void): Promise<string> {
  return new Promise((resolve) => {
    server = createServer((req, res) => handler(req.url ?? "", res));
    server.listen(0, "127.0.0.1", () => {
      const address = server?.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = null;
  }
});

function provider(kind: ProviderKind, baseUrl: string, overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "prov_models",
    name: `测试 ${kind}`,
    kind,
    baseUrl,
    apiKey: "sk-test",
    models: [],
    enabled: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("listProviderModels", () => {
  it("demo 返回内置模型且不发请求", async () => {
    const result = await listProviderModels(provider("demo", ""));
    expect(result.endpoint).toBe("demo");
    expect(result.models.map((m) => m.id)).toEqual(["yanfield-demo", "yanfield-demo-prose"]);
  });

  it("OpenAI 兼容：GET /v1/models 解析 data[].id 并去重", async () => {
    const base = await listen((url, res) => {
      expect(url).toBe("/v1/models");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ id: "gpt-test", owned_by: "x" }, { id: "gpt-test" }, { id: "o-test" }] }));
    });
    const result = await listProviderModels(provider("openai", base));
    expect(result.endpoint).toBe(`${base}/v1/models`);
    expect(result.models.map((m) => m.id)).toEqual(["gpt-test", "o-test"]);
  });

  it("OpenAI 兼容：baseUrl 已带 /v1 时直接拼 /models", async () => {
    const base = await listen((url, res) => {
      expect(url).toBe("/v1/models");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ id: "deepseek-chat" }] }));
    });
    const result = await listProviderModels(provider("openai", `${base}/v1`));
    expect(result.endpoint).toBe(`${base}/v1/models`);
    expect(result.models[0].id).toBe("deepseek-chat");
  });

  it("Anthropic：GET /v1/models 解析 display_name 为 label", async () => {
    const base = await listen((url, res) => {
      expect(url).toBe("/v1/models");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [{ id: "claude-test", display_name: "Claude Test", type: "model" }] }));
    });
    const result = await listProviderModels(provider("anthropic", base));
    expect(result.models).toEqual([{ id: "claude-test", label: "Claude Test" }]);
  });

  it("Gemini：v1beta/models 过滤非 generateContent 并带 contextWindow", async () => {
    const base = await listen((url, res) => {
      expect(url).toContain("/v1beta/models?key=sk-test");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          models: [
            { name: "models/gemini-test", displayName: "Gemini Test", supportedGenerationMethods: ["generateContent"], inputTokenLimit: 1000000 },
            { name: "models/text-embedding", supportedGenerationMethods: ["embedContent"] },
          ],
        }),
      );
    });
    const result = await listProviderModels(provider("gemini", base));
    expect(result.models).toEqual([{ id: "gemini-test", label: "Gemini Test", contextWindow: 1000000 }]);
  });

  it("Ollama 原生：无 /v1 时走 /api/tags", async () => {
    const base = await listen((url, res) => {
      expect(url).toBe("/api/tags");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ models: [{ name: "qwen2.5:7b" }, { name: "llama3.1:8b" }] }));
    });
    const result = await listProviderModels(provider("ollama", base, { apiKey: "" }));
    expect(result.endpoint).toBe(`${base}/api/tags`);
    expect(result.models.map((m) => m.id)).toEqual(["qwen2.5:7b", "llama3.1:8b"]);
  });

  it("401 转成中文 ProviderError", async () => {
    const base = await listen((_url, res) => {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "invalid api key" } }));
    });
    await expect(listProviderModels(provider("openai", base))).rejects.toMatchObject({
      name: "ProviderError",
    });
    try {
      await listProviderModels(provider("openai", base));
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).message).toContain("鉴权失败");
    }
  });

  it("未填 Key 且非 ollama/demo 时直接报错不发请求", async () => {
    await expect(listProviderModels(provider("openai", "http://127.0.0.1:1", { apiKey: "" }))).rejects.toThrow(
      /未填写 API Key/,
    );
  });
});
