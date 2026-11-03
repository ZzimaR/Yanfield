import {describe,it,expect} from "vitest";
import {discoverModelCapabilities} from "@/lib/ai/model-capabilities";
import {thinkingProfile,thinkingParameters,modelThinking} from "@/lib/ai/thinking";
import type {ModelOption} from "@/lib/types";
const provider=(kind:string,baseUrl:string,raw:unknown)=>({id:"p",kind,baseUrl,models:[{id:"fresh-model",label:"Fresh",...discoverModelCapabilities(raw,kind)}] as ModelOption[]});
describe("发现模型能力与实际参数",()=>{
 it("DeepSeek元数据提供档位、默认值、上下文与输出上限，不再猜模型名称",()=>{
  const p=provider("openai","https://api.deepseek.com/v1",{context_window:1048576,max_output_tokens:12345,effort:{supported_levels:["low","max"],default_level:"low"}});
  expect(p.models[0]).toMatchObject({contextWindow:1048576,maxOutputTokens:12345,thinking:{levels:["low","max"],defaultLevel:"low"}});
  expect(thinkingProfile(p,"fresh-model").options.map(o=>o.value)).toEqual(["default","off","low","max"]);
  expect(thinkingParameters(p,"fresh-model","max")).toEqual({thinking:{type:"enabled"},reasoning_effort:"max"});
  expect(thinkingParameters(p,"fresh-model","high")).toEqual({});
 });
 it("Claude不同模型声明的档位不同，强制思考不提供关闭",()=>{
  const p=provider("anthropic","https://api.anthropic.com",{capabilities:{thinking:{supported:true,types:{disabled:{supported:false}}},effort:{supported:true,low:{supported:true},medium:{supported:true},high:{supported:false},xhigh:{supported:true}}}});
  expect(thinkingProfile(p,"fresh-model").options.map(o=>o.value)).toEqual(["default","low","medium","xhigh"]);
  expect(thinkingParameters(p,"fresh-model","medium")).toEqual({output_config:{effort:"medium"}});
  expect(thinkingParameters(p,"fresh-model","off")).toEqual({});
 });
 it("明确支持关闭的Claude发送disabled；不能把low当关闭",()=>{
  const p=provider("anthropic","https://api.anthropic.com",{capabilities:{thinking:{supported:true,types:{disabled:{supported:true}}},effort:{supported:true,low:{supported:true}}}});
  expect(thinkingParameters(p,"fresh-model","off")).toEqual({thinking:{type:"disabled"}});
  expect(thinkingParameters(p,"fresh-model","low")).toEqual({output_config:{effort:"low"}});
 });
 it("OpenRouter按每模型reasoning元数据生成参数而非DeepSeek参数",()=>{
  const p=provider("openai","https://openrouter.ai/api/v1",{reasoning:{supported_efforts:["minimal","medium","high"],default_effort:"medium",mandatory:true},supported_parameters:["reasoning"],context_length:9999,top_provider:{max_completion_tokens:888}});
  expect(thinkingProfile(p,"fresh-model").options.map(o=>o.value)).toEqual(["default","minimal","medium","high"]);
  expect(thinkingParameters(p,"fresh-model","medium")).toEqual({reasoning:{effort:"medium"}});
  expect(p.models[0]).toMatchObject({supportedParameters:["reasoning"],maxOutputTokens:888});
 });
 it("OpenRouter非强制模型允许关闭，mandatory未知时不猜可关闭",()=>{
  const raw={reasoning:{supported_efforts:["low"],mandatory:false}};
  const p=provider("openai","https://openrouter.ai/api/v1",raw);
  expect(thinkingParameters(p,"fresh-model","off")).toEqual({reasoning:{enabled:false}});
  const unknown=provider("openai",p.baseUrl,{reasoning:{supported_efforts:["low"]}});
  expect(thinkingParameters(unknown,"fresh-model","off")).toEqual({});
 });
 it("Gemini只声明支持思考时保留声明但不编造强度",()=>{
  const p=provider("gemini","https://generativelanguage.googleapis.com",{thinking:true,inputTokenLimit:1000,outputTokenLimit:500});
  expect(p.models[0]).toMatchObject({thinking:{supported:true},contextWindow:1000,maxOutputTokens:500});
  expect(thinkingProfile(p,"fresh-model").options.map(o=>o.value)).toEqual(["default"]);
 });
 it("显式不支持覆盖旧名称兜底；未知不会变成不支持",()=>{
  const p={kind:"openai",baseUrl:"https://api.deepseek.com/v1",models:[{id:"deepseek-flash",label:"X",thinking:{supported:false}}]};
  expect(thinkingProfile(p,"deepseek-flash").options).toHaveLength(1);
  expect(discoverModelCapabilities({id:"plain"},"openai").thinking).toBeUndefined();
  expect(discoverModelCapabilities({thinking:false},"gemini").thinking).toEqual({supported:false});
 });
 it("切换网关后不沿用旧参数；不认识的接口只保留能力声明",()=>{
  const p=provider("openai","https://custom.example/v1",{effort:{supported_levels:["low"]}});
  expect(thinkingProfile(p,"fresh-model").capability?.supported).toBe(true);
  expect(thinkingParameters(p,"fresh-model","low")).toEqual({});
  expect(modelThinking({modelThinking:{"p:fresh-model":"low"}},p,"fresh-model")).toBeUndefined();
 });
 it("重新拉取后已不支持的旧档位回退默认，不发送失效参数",()=>{
  const p=provider("anthropic","https://api.anthropic.com",{capabilities:{effort:{supported:true,low:{supported:true}}}});
  expect(modelThinking({modelThinking:{"p:fresh-model":"max"}},p,"fresh-model")).toBe("default");
  expect(thinkingParameters(p,"fresh-model","default")).toEqual({});
 });
 it("忽略无效元数据与未知枚举，不把任意字段塞进请求",()=>{
  const p=provider("openai","https://api.deepseek.com",{context_window:-1,max_output_tokens:"huge",effort:{supported_levels:["low","low","invented",{},1],default_level:"invalid"}});
  expect(p.models[0].contextWindow).toBeUndefined();expect(p.models[0].maxOutputTokens).toBeUndefined();
  expect(p.models[0].thinking?.levels).toEqual(["low"]);
  expect(thinkingParameters(p,"fresh-model","ultra")).toEqual({});
 });
});
