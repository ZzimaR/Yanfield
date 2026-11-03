import {describe,it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {AgentProgress} from "@/components/ai/AgentProgress";
import type {AgentRun} from "@/lib/ai/agent/types";
const fixture={status:"running",preview:"潮水退了。",progress:[{id:"p1",text:"先读取已有正文。",stepIndex:0},{id:"p2",text:"已经读完，现在写下一章。",stepIndex:1}],steps:[{id:"s1",label:"读取材料",detail:"",tool:"read",status:"complete"},{id:"s2",label:"写作与修订",detail:"",tool:"write_chapter",status:"running"}]} as AgentRun;
describe("Agent 进展展示",()=>{
 it("保留此前说明，当前写作步骤显示实时字数和正文",()=>{
  const html=renderToStaticMarkup(<AgentProgress run={fixture} renderTargets={()=>null}/>);
  expect(html.indexOf("先读取已有正文。")).toBeLessThan(html.indexOf("已经读完，现在写下一章。"));
  expect(html).toContain("已生成 4 字");expect(html).toContain("潮水退了。");expect(html).not.toContain("读取材料");
 });
 it("结束后保留进展和产物入口，不残留实时预览",()=>{
  const run={...fixture,status:"ready",steps:fixture.steps.map(s=>({...s,status:"complete"}))} as AgentRun;
  const html=renderToStaticMarkup(<AgentProgress run={run} renderTargets={()=> <span>打开候选</span>}/>);
  expect(html).toContain("先读取已有正文。");expect(html).toContain("打开候选");expect(html).not.toContain("正文实时预览");
 });
 it("停止后仍保留未完成草稿",()=>{
  const run={...fixture,status:"aborted",steps:fixture.steps.map(s=>({...s,status:s.status==="running"?"error":s.status}))} as AgentRun;
  const html=renderToStaticMarkup(<AgentProgress run={run} renderTargets={()=>null}/>);
  expect(html).toContain("未完成草稿");expect(html).toContain("潮水退了。");
 });
 it("兼容没有进展字段的旧任务",()=>{
  expect(()=>renderToStaticMarkup(<AgentProgress run={{...fixture,progress:undefined}} renderTargets={()=>null}/>)).not.toThrow();
 });
});

it("Agent说明按Markdown排版，保留引号且不执行原始HTML",()=>{
 const html=renderToStaticMarkup(<AgentProgress run={{...fixture,progress:[{id:"p",stepIndex:0,text:'### 核对结果\n\n**只改口吻**，保留“账本下”。\n\n<img src=x onerror=alert(1)>'}]}} renderTargets={()=>null}/>);
 expect(html).toContain("<strong>只改口吻</strong>");expect(html).not.toContain("### 核对结果");expect(html).not.toContain('<img src="x"');expect(html).toContain("保留“账本下”");
});
