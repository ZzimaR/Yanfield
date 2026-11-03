import { afterEach, describe, expect, it, vi } from "vitest";
import { streamCompletion, type ProviderChunk } from "@/lib/ai/provider";
import type { ProviderConfig } from "@/lib/types";
afterEach(()=>vi.unstubAllGlobals());
describe("输出截断提示",()=>{
  it.each([
    ["openai",{choices:[{delta:{content:"尚未完成"},finish_reason:"length"}]}],
    ["anthropic",{type:"message_delta",delta:{stop_reason:"max_tokens"},usage:{output_tokens:10}}],
    ["gemini",{candidates:[{finishReason:"MAX_TOKENS",content:{parts:[{text:"尚未完成"}]}}]}],
  ] as const)("%s 截断不冒充完成",async(kind,payload)=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(`data: ${JSON.stringify(payload)}\n\n`,{headers:{"content-type":"text/event-stream"}})));
    const chunks:ProviderChunk[]=[];
    const run=async()=>{for await(const chunk of streamCompletion({provider:{kind,baseUrl:"https://example.test",apiKey:"test"} as ProviderConfig,model:"test",messages:[{role:"user",content:"写一章"}],maxTokens:32000}))chunks.push(chunk);};
    await expect(run()).rejects.toThrow("模型输出因长度限制被截断");
    expect(chunks.some(c=>c.type==="done")).toBe(false);
  });
});
