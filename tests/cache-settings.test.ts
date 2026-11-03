import {describe,it,expect} from "vitest";
import {buildSettingsPatch} from "@/app/api/_lib/settings";
import {DEFAULT_APP_SETTINGS} from "@/lib/types";
describe("缓存单价设置",()=>{
 it("第三档单价可保存并保留另外两档",()=>{
  expect(buildSettingsPatch({...DEFAULT_APP_SETTINGS,aiPricing:{inputPerMillion:2,outputPerMillion:4}},{aiPricing:{cachedInputPerMillion:0.2}}).aiPricing).toEqual({inputPerMillion:2,outputPerMillion:4,cachedInputPerMillion:0.2});
 });
 it("显式免费与清空单价不同，清空后恢复未知",()=>{
  const settings={...DEFAULT_APP_SETTINGS,aiPricing:{inputPerMillion:2,outputPerMillion:4,cachedInputPerMillion:0.2}};
  expect(buildSettingsPatch(settings,{aiPricing:{cachedInputPerMillion:0}}).aiPricing?.cachedInputPerMillion).toBe(0);
  expect(buildSettingsPatch(settings,{aiPricing:{cachedInputPerMillion:null}}).aiPricing?.cachedInputPerMillion).toBeUndefined();
 });
 it("拒绝负数、非数字和过大单价",()=>{
  for(const value of [-1,"oops",100001])expect(()=>buildSettingsPatch(DEFAULT_APP_SETTINGS,{aiPricing:{cachedInputPerMillion:value}})).toThrow();
 });
});
