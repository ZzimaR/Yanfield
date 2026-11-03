import {describe,it,expect} from "vitest";
import {parseAgentDecision} from "@/lib/ai/agent/decision";
const invoke=(id:string)=>`<｜｜DSML｜｜ invoke name="read"><｜｜DSML｜｜ parameter name="args" string="false">${JSON.stringify({kind:"character",id})}</｜｜DSML｜｜ parameter></｜｜DSML｜｜ invoke>`;
describe("DeepSeek decision envelope",()=>{
 it("单个调用不会被误识别为内嵌参数对象",()=>{
  expect(parseAgentDecision(`<｜｜DSML｜｜ calls>${invoke("a")}</｜｜DSML｜｜ calls>`)).toEqual({message:"",calls:[{name:"read",args:{kind:"character",id:"a"}}],done:false});
 });
 it("保留调用顺序与前置说明",()=>{
  const result=parseAgentDecision(`先读取卡片。<｜｜DSML｜｜ calls>${["a","b","c","d"].map(invoke).join("\n")}</｜｜DSML｜｜ calls>`) as {message:string;calls:{args:{id:string}}[]};
  expect(result.message).toBe("先读取卡片。");expect(result.calls.map(c=>c.args.id)).toEqual(["a","b","c","d"]);
 });
 it("截断、残留文本和损坏参数仍返回无效结果，交给修复流程",()=>{
  expect(parseAgentDecision(`<｜｜DSML｜｜ calls>${invoke("a")}`)).toBeNull();
  expect(parseAgentDecision(`<｜｜DSML｜｜ calls>bad${invoke("a")}</｜｜DSML｜｜ calls>`)).toBeNull();
  expect(parseAgentDecision(`<｜｜DSML｜｜ calls>${invoke("a").replace('{"kind"','{broken"kind"')}</｜｜DSML｜｜ calls>`)).toBeNull();
 });
 it("普通分析不会被伪装成工具调用，原 JSON 保持兼容",()=>{
  expect(parseAgentDecision("我先分析设定冲突。然后请作者决定。")).toBeNull();
  expect(parseAgentDecision('{"message":"完成","calls":[],"done":true}')).toEqual({message:"完成",calls:[],done:true});
 });
});
