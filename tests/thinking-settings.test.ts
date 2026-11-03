import {describe,it,expect} from "vitest";
import {buildSettingsPatch} from "@/app/api/_lib/settings";
import {DEFAULT_APP_SETTINGS} from "@/lib/types";
import {modelThinking,thinkingKey,supportsThinking} from "@/lib/ai/thinking";
import {PROVIDER_PRESETS} from "@/lib/defaults";
import {proposalReceipt} from "@/lib/ai/agent/receipt";
import type {AgentChange} from "@/lib/ai/agent/types";
it("服务商预设不再夹带静态推荐模型",()=>{expect(PROVIDER_PRESETS.length).toBeGreaterThan(5);expect(PROVIDER_PRESETS.every(p=>p.models.length===0)).toBe(true);});
describe("按模型记忆思考程度",()=>{
 it("不同服务/模型互不覆盖，未适配模型不虚报档位",()=>{
  const key=thinkingKey("p","deepseek-flash");const settings={modelThinking:{[key]:"low" as const}};
  expect(modelThinking(settings,{id:"p",kind:"openai",baseUrl:"https://api.deepseek.com/v1"},"deepseek-flash")).toBe("low");
  expect(modelThinking(settings,{id:"other",kind:"openai",baseUrl:"https://api.deepseek.com/v1"},"deepseek-flash")).toBe("default");
  expect(supportsThinking({kind:"openai"},"custom-model")).toBe(false);
 });
 it("设置合并保留其他档位，拒绝不支持的值",()=>{
  const current={...DEFAULT_APP_SETTINGS,modelThinking:{"a:deepseek-flash":"high" as const}};
  expect(buildSettingsPatch(current,{modelThinking:{"b:deepseek-flash":"low"}}).modelThinking).toEqual({"a:deepseek-flash":"high","b:deepseek-flash":"low"});
  expect(buildSettingsPatch(current,{modelThinking:{"b:x":"medium","c:x":"xhigh","d:x":"default"}}).modelThinking).toMatchObject({"b:x":"medium","c:x":"xhigh","d:x":"default"});
  expect(()=>buildSettingsPatch(current,{modelThinking:{"b:x":"made-up"}})).toThrow();
  expect(()=>buildSettingsPatch(current,{modelThinking:{"b:x":["low"]}})).toThrow();
 });
});
it("资料候选回执提供完整替换语义与可能丢失的原句，不能只凭ID谎称保留",()=>{
 const change={id:"draft",title:"渡口",state:"pending",before:{content:"位置：石阶尽头。退潮送信，涨潮收船。"},after:{content:"位置：石阶尽头。林舟在此记账。"}} as unknown as AgentChange;
 const receipt=proposalReceipt(change);expect(receipt.possiblyRemoved).toEqual([{field:"content",text:"退潮送信，涨潮收船"}]);expect(receipt.fieldChanges[0].afterPreview).toContain("林舟");
});
