import { afterEach, describe, expect, it, vi } from "vitest";
import { streamCompletion, testProvider, type ProviderChunk } from "@/lib/ai/provider";
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

describe("连接探测与自动输出",()=>{
  it("8 token 探测截断仍说明已连接",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(`data: ${JSON.stringify({choices:[{delta:{reasoning_content:"响应"},finish_reason:"length"}],usage:{prompt_tokens:1,completion_tokens:8}})}\n\n`)));
    const result=await testProvider({kind:"openai",baseUrl:"https://example.test",apiKey:"test",models:[{id:"test"}]} as ProviderConfig);
    expect(result.ok).toBe(true);
  });
  it("自动模式不发送 max_tokens，显式设置时才发送",async()=>{
    const fetcher=vi.fn(async()=>new Response('data: [DONE]\n\n'));vi.stubGlobal("fetch",fetcher);
    for(const maxTokens of [0,undefined,32000]){
      for await(const chunk of streamCompletion({provider:{kind:"openai",baseUrl:"https://example.test"} as ProviderConfig,model:"test",messages:[{role:"user",content:"写一章"}],maxTokens}))void chunk;
      const body=JSON.parse((fetcher.mock.calls.at(-1) as unknown as [string,RequestInit])[1].body as string);
      if(maxTokens)expect(body.max_tokens).toBe(maxTokens);else expect(body).not.toHaveProperty("max_tokens");
    }
  });
  it("连接探测仍报告鉴权失败",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({error:{message:"bad key"}}),{status:401})));
    expect((await testProvider({kind:"openai",baseUrl:"https://example.test",apiKey:"test",models:[{id:"test"}]} as ProviderConfig)).ok).toBe(false);
  });
});
