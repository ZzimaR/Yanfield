import {describe,it,expect} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {ChatComposer} from "@/components/ai/ChatComposer";
const props={value:"下一条需求",onChange:()=>{},mode:"chat" as const,onModeChange:()=>{},mentions:[],onMentionsChange:()=>{},onSend:()=>{},onStop:()=>{},streaming:false,novelId:"test"};
describe("发送中的输入区",()=>{
 it("准备阶段禁用发送，仍可编辑下一条需求",()=>{
  const html=renderToStaticMarkup(<ChatComposer {...props} sending/>);
  const send=html.match(/<button[^>]*>[\s\S]*?<\/button>/g)?.find(b=>b.includes("准备中…"));
  expect(send).toContain('disabled=""');expect(html).not.toMatch(/<textarea[^>]*disabled/);
 });
 it("生成中只提供停止按钮，保留草稿输入",()=>{
  const html=renderToStaticMarkup(<ChatComposer {...props} streaming/>);
  expect(html).toContain("停止");expect(html).not.toContain(">发送<");expect(html).not.toMatch(/<textarea[^>]*disabled/);
 });
});
