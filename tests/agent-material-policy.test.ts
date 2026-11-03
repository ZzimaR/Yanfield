import {describe,it,expect} from "vitest";
import {automaticMaterialPolicy as policy} from "@/lib/ai/agent/material-policy";
describe("自动资料回填的作者约束",()=>{
 it.each(["不增加资料","别再整理资料","不新建卡","不用补全设定","不要新增设定卡","不用建卡","不要自动整理资料","仅润色正文","只需要修改正文","只写正文、不建卡","no new cards"])("识别禁止回填：%s",message=>expect(policy(message)).toBe("skip"));
 it("连续追问保留只改正文约束，明确重新授权可恢复",()=>{
  expect(policy("再短一点",{request:"只写正文"})).toBe("skip");
  expect(policy("结尾再自然一点",{request:"再短一点",materialPolicy:"skip"})).toBe("skip");
  expect(policy("这次顺便整理正文中提到的人物卡",{request:"再短一点",materialPolicy:"skip"})).toBe("auto");
 });
 it("只禁止正文不妨碍资料整理，选区修改从不自动建卡",()=>{
  expect(policy("不要修改正文，补充资料")).toBe("auto");
  expect(policy("润色这一句",undefined,"选区")).toBe("skip");
 });
});
