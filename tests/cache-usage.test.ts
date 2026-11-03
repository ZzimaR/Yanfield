import {describe,it,expect} from "vitest";
import {inputBreakdown,openAiCachedTokens} from "@/lib/ai/cache-usage";
import {estimateAiCost,formatCny} from "@/lib/ai/cost";
describe("缓存计量与收费",()=>{
 it("小额缓存费用不被四位小数舍入成零",()=>{
  const amount=estimateAiCost(1000,0,{inputPerMillion:2,outputPerMillion:4,cachedInputPerMillion:0.02},{cachedInputTokens:1000});
  expect(amount).toBe(0.00002);expect(formatCny(amount!)).toBe("¥0.000020");expect(formatCny(0.0000002)).toBe("¥<0.000001");
 });
 it("读取 DeepSeek、OpenAI 字段并保留真实零命中",()=>{
  expect(openAiCachedTokens({prompt_tokens:100,prompt_cache_hit_tokens:80,prompt_cache_miss_tokens:20})).toBe(80);
  expect(openAiCachedTokens({prompt_tokens:100,prompt_tokens_details:{cached_tokens:0}})).toBe(0);
  expect(openAiCachedTokens({prompt_tokens:100,prompt_cache_miss_tokens:30})).toBe(70);
 });
 it("缺失或异常统计不冒充零命中",()=>{
  expect(openAiCachedTokens({prompt_tokens:100})).toBeUndefined();
  expect(openAiCachedTokens({prompt_tokens:100,prompt_cache_hit_tokens:120})).toBeUndefined();
  expect(openAiCachedTokens({prompt_tokens:100,prompt_cache_hit_tokens:80,prompt_cache_miss_tokens:50})).toBeUndefined();
  expect(openAiCachedTokens({prompt_tokens:100,prompt_cache_hit_tokens:-1})).toBeUndefined();
 });
 it("多次调用中未报告的输入保持未知，不计入已知缓存未命中",()=>{
  expect(inputBreakdown(150,{cachedInputTokens:80,cacheReportedInputTokens:100})).toEqual({cached:80,uncached:20,unknown:50,reported:100});
  expect(inputBreakdown(150)).toEqual({cached:0,uncached:0,unknown:150,reported:0});
 });
 it("输入总量中缓存命中只收一次，已知、未知输入各按对应费率估计",()=>{
  expect(estimateAiCost(1e6,1e5,{inputPerMillion:2,outputPerMillion:4,cachedInputPerMillion:0.2},{cachedInputTokens:8e5,cacheReportedInputTokens:9e5})).toBe(0.96);
 });
 it("缓存单价缺失时金额未知，显式零单价可表示免费",()=>{
  expect(estimateAiCost(1e6,0,{inputPerMillion:2,outputPerMillion:4},{cachedInputTokens:8e5,cacheReportedInputTokens:1e6})).toBeNull();
  expect(estimateAiCost(1e6,0,{inputPerMillion:2,outputPerMillion:4,cachedInputPerMillion:0},{cachedInputTokens:8e5,cacheReportedInputTokens:1e6})).toBe(0.4);
 });
});
