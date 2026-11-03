import {readFileSync} from "node:fs";
import {describe,it,expect,vi,afterEach} from "vitest";
import {parseDeepseekPricing,fetchOfficialPricing} from "@/lib/ai/official-pricing";
import type {ProviderConfig} from "@/lib/types";
const html=readFileSync(new URL("./fixtures/deepseek-pricing.html",import.meta.url),"utf8");
afterEach(()=>vi.unstubAllGlobals());
describe("官方单价",()=>{
  it("解析合并行列，区分缓存命中、未命中和峰谷时段",()=>{
    expect(parseDeepseekPricing(html,"deepseek-flash")).toEqual([
      {period:"空闲时段",inputPerMillion:1,cachedInputPerMillion:0.02,outputPerMillion:4},
      {period:"高峰时段",inputPerMillion:2,cachedInputPerMillion:0.04,outputPerMillion:8},
    ]);
    expect(parseDeepseekPricing(html,"deepseek-v4-pro")[1]).toMatchObject({inputPerMillion:9,outputPerMillion:27});
  });
  it("仅映射官方确认的旧模型名",()=>expect(parseDeepseekPricing(html,"deepseek-v4-flash")).toEqual(parseDeepseekPricing(html,"deepseek-flash")));
  it("页面结构或币种变化时失败，不生成零价格",()=>{
    expect(()=>parseDeepseekPricing(html.replaceAll("元","美元"),"deepseek-flash")).toThrow("无法可靠解析");
    expect(()=>parseDeepseekPricing("error","deepseek-flash")).toThrow();
  });
  it("不访问第三方服务或发送 API Key",async()=>{
    const fetcher=vi.fn(async()=>new Response(html));vi.stubGlobal("fetch",fetcher);
    await expect(fetchOfficialPricing({baseUrl:"https://example.test"} as ProviderConfig,"deepseek-flash")).rejects.toThrow("中转服务");
    expect(fetcher).not.toHaveBeenCalled();
    const quote=await fetchOfficialPricing({id:"p",baseUrl:"https://api.deepseek.com/v1",apiKey:"secret"} as ProviderConfig,"deepseek-flash");
    expect(quote.source).toContain("api-docs.deepseek.com");expect(quote.fetchedAt).toBeTruthy();
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("secret");
  });
});
