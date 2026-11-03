import {describe,it,expect} from "vitest";
import {chapterDirectoryWindow,writerMessages,stableJson,candidateContext,type WriterContext} from "@/lib/ai/agent/context";
const base:WriterContext={style:"克制",customInstruction:"保留悬念",forbiddenWords:["总而言之"],materials:[["chapter:c1",{id:"c1",content:"唯一正文"}],["world:b",{id:"b",content:"按潮时收信",updatedAt:"old"}],["character:a",{id:"a",identity:"收信人"}]],currentKey:"chapter:c1",current:{id:"c1",content:"唯一正文"},request:"润色",instruction:"加强悬念",words:2000,mode:"rewrite",changes:[]};
describe("可缓存写作上下文",()=>{
 it("任务、目标字数和当前正文变化不改变稳定规则与资料前缀",()=>{
  const before=writerMessages(base),after=writerMessages({...base,request:"扩写",instruction:"加入对话",words:3000,current:{id:"c2",content:"新正文"}});
  expect(before.slice(0,2)).toEqual(after.slice(0,2));expect(before[2]).not.toEqual(after[2]);expect(before[3]).not.toEqual(after[3]);
 });
 it("当前正文只出现一次，资料顺序和非事实时间戳不会打破前缀",()=>{
  const before=writerMessages(base);expect(JSON.stringify(before).match(/唯一正文/g)).toHaveLength(1);
  const after=writerMessages({...base,materials:[...base.materials].reverse().map(([key,row])=>[key,{...(row as object),updatedAt:"new"}])});
  expect(before.slice(0,2)).toEqual(after.slice(0,2));
 });
 it("资料事实修改必须使缓存前缀变化，不复用陈旧设定",()=>{
  expect(writerMessages({...base,materials:[["world:b",{id:"b",content:"不可拆信"}]]})[1]).not.toEqual(writerMessages(base)[1]);
 });
 it("保留数组次序与选区约束",()=>{
  expect(stableJson({b:1,a:[2,1]})).toBe('{"a":[2,1],"b":1}');
  expect(JSON.parse(writerMessages({...base,mode:"selection",selection:"特定句子"})[3].content)).toMatchObject({mode:"selection",selection:"特定句子"});
 });
});

it("两千章目录只返回窗口、全局序号与明确引用，不把全书目录塞给模型",()=>{
 const chapters=Array.from({length:2000},(_,i)=>({id:`c${i}`,title:`第${i+1}章`,volumeId:null,orderIndex:i,wordCount:2000}));
 const result=chapterDirectoryWindow(chapters,"c100",["c0"]);
 expect(result).toHaveLength(18);expect(result.find(c=>c.id==="c100")?.index).toBe(101);expect(result.some(c=>c.id==="c1999")).toBe(true);expect(result.some(c=>c.id==="c0")).toBe(true);
});

it("读取候选重新统计字数，不沿用保存版本的旧数值",()=>{
 const value=candidateContext({id:"candidate",kind:"chapter",targetId:"chapter",before:{content:"<p>旧。</p>",wordCount:1},after:{content:"<p>这是新正文。</p>"}});
 expect(value).toMatchObject({id:"chapter",wordCount:5,content:"<p>这是新正文。</p>"});
});
