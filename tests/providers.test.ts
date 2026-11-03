/**
 * Provider 适配层协议测试：
 * 用本地 HTTP 服务模拟各家 SSE 响应，验证「真实请求/真实流解析」而不是 mock 掉适配层。
 * 覆盖：OpenAI 兼容、Anthropic Messages、Gemini generateContent、错误中文化。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { ProviderError, streamCompletion, testProvider, type ProviderChunk } from "../lib/ai/provider";
import type { ProviderConfig, ProviderKind } from "../lib/types";

let server: Server;
let base = "";

function once(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      (req as IncomingMessage & { body: string }).body = body;
      handler(req, res);
    });
  });
  server.listen(0, "127.0.0.1");
}

function sse(res: ServerResponse, lines: string[]) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  for (const line of lines) res.write(`data: ${line}\n\n`);
  res.end();
}

function provider(kind: ProviderKind, overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "prov_test",
    name: `测试 ${kind}`,
    kind,
    baseUrl: "",
    apiKey: "sk-test",
    models: [{ id: "test-model", label: "Test" }],
    enabled: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

async function collect(config: ProviderConfig, model = "test-model"): Promise<ProviderChunk[]> {
  const chunks: ProviderChunk[] = [];
  for await (const chunk of streamCompletion({
    provider: config,
    model,
    messages: [{ role: "system", content: "sys" }, { role: "user", content: "你好" }],
    temperature: 0.5,
  })) {
    chunks.push(chunk);
  }
  return chunks;
}

type Captured = { path: string; headers: IncomingMessage["headers"]; body: string };

describe("Provider 适配层", () => {
  const captured: Captured[] = [];

  it("缓存命中统计穿过流式适配层，输入总量不重复相加",async()=>{
    const chunks=await collect(provider("openai",{baseUrl:base}),"cache-model");
    expect(chunks.find(c=>c.type==="usage")).toMatchObject({promptTokens:15,completionTokens:6,cachedInputTokens:10});
  });

  beforeAll(async () => {
    once((req, res) => {
      captured.push({ path: req.url ?? "", headers: req.headers, body: (req as IncomingMessage & { body: string }).body });
      if (req.url?.includes("/v1/messages")) {
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.write(`event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 12 } } })}\n\n`);
        res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "潮信" } })}\n\n`);
        res.write(`event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "已至" } })}\n\n`);
        res.write(`event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", usage: { output_tokens: 7 } })}\n\n`);
        res.end();
        return;
      }
      if (req.url?.includes(":streamGenerateContent")) {
        sse(res, [
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "星" }, { text: "火" }] } }] }),
          JSON.stringify({ usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 4 } }),
        ]);
        return;
      }
      sse(res, [
        JSON.stringify({ choices: [{ delta: { reasoning_content: "想一想。", content: "你" } }] }),
        JSON.stringify({ choices: [{ delta: { content: "好" } }] }),
        JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 15, completion_tokens: 6,...(JSON.parse((req as IncomingMessage & {body:string}).body).model==="cache-model"?{prompt_cache_hit_tokens:10,prompt_cache_miss_tokens:5}:{}) } }),
        "[DONE]",
      ]);
    });
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const address = server.address() as AddressInfo;
    base = `http://127.0.0.1:${address.port}`;
  });

  afterAll(() => {
    server.closeAllConnections();
    server.close();
  });

  it("OpenAI 兼容协议：解析 delta / reasoning / usage", async () => {
    const result = await collect(provider("openai", { baseUrl: `${base}/v1` }));
    expect(result.filter((c) => c.type === "delta").map((c) => ("text" in c ? c.text : "")).join("")).toBe("你好");
    expect(result.find((c) => c.type === "reasoning")).toMatchObject({ type: "reasoning", text: "想一想。" });
    expect(result.find((c) => c.type === "usage")).toMatchObject({ promptTokens: 15, completionTokens: 6 });
    expect(result.at(-1)).toEqual({ type: "done" });
    const request = captured.at(-1);
    expect(request?.path).toContain("/v1/chat/completions");
    expect(request?.headers.authorization).toBe("Bearer sk-test");
    expect(JSON.parse(request?.body ?? "{}")).toMatchObject({ model: "test-model", stream: true });
  });

  it("Anthropic Messages 协议：x-api-key + 事件流", async () => {
    const result = await collect(provider("anthropic", { baseUrl: base }));
    expect(result.filter((c) => c.type === "delta").map((c) => ("text" in c ? c.text : "")).join("")).toBe("潮信已至");
    expect(result.find((c) => c.type === "usage")).toMatchObject({ promptTokens: 12, completionTokens: 7 });
    const request = captured.at(-1);
    expect(request?.path).toContain("/v1/messages");
    expect(request?.headers["x-api-key"]).toBe("sk-test");
    expect(request?.headers["anthropic-version"]).toBeTruthy();
  });

  it("Gemini 协议：streamGenerateContent + usageMetadata", async () => {
    const result = await collect(provider("gemini", { baseUrl: base }));
    expect(result.filter((c) => c.type === "delta").map((c) => ("text" in c ? c.text : "")).join("")).toBe("星火");
    expect(result.find((c) => c.type === "usage")).toMatchObject({ promptTokens: 9, completionTokens: 4 });
    expect(captured.at(-1)?.path).toContain(":streamGenerateContent?alt=sse&key=sk-test");
  });

  it("鉴权失败时抛出可读的中文错误（并保留 status）", async () => {
    const failing = createServer((_req, res) => {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Incorrect API key provided" } }));
    });
    await new Promise<void>((resolve) => failing.listen(0, "127.0.0.1", () => resolve()));
    const address = failing.address() as AddressInfo;
    try {
      await expect(
        collect(provider("openai", { baseUrl: `http://127.0.0.1:${address.port}/v1` })),
      ).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(ProviderError);
        const known = error as ProviderError;
        expect(known.status).toBe(401);
        expect(known.message).toContain("鉴权失败");
        return true;
      });
    } finally {
      failing.closeAllConnections();
      failing.close();
    }
  });

  it("测试连接：未填 Key 时直接给出提示，不发起请求", async () => {
    const result = await testProvider(provider("openai", { apiKey: "" }));
    expect(result.ok).toBe(false);
    expect(result.message).toContain("API Key");
  });
});
