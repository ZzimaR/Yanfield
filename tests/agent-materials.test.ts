import { describe,it,expect } from "vitest";
import { prepareMaterial, type ExistingMaterial } from "@/lib/ai/agent/materials";
const sources=[{id:"ch1",title:"退潮",text:"周晚在渡口的晚记收信。小满每天替他送信，从不拆信。",candidate:true}];
const item={kind:"character" as const,fields:{name:"小满",identity:"晚记的送信人",personality:"从不拆信"},evidence:[{sourceId:"ch1",quote:"小满每天替他送信，从不拆信。"}]};
describe("正文资料整理",()=>{
  it("保留逐字引用和候选正文标记，不添加未知字段",()=>{
    const result=prepareMaterial(item,sources,[]);
    expect(result.targetId).toBeNull();expect(result.fields).toEqual(item.fields);
    expect(result.fields).not.toHaveProperty("age");expect(result.evidence[0]).toMatchObject({candidate:true,title:"退潮"});
  });
  it("别名匹配已有卡，只补空白，不覆盖身份",()=>{
    const existing:ExistingMaterial[]=[{kind:"character",id:"person",fields:{name:"林小满",aliases:["小满"],identity:"作者确定的身份",personality:""}}];
    const result=prepareMaterial(item,sources,existing);
    expect(result.targetId).toBe("person");expect(result.fields).toEqual({personality:"从不拆信"});
  });
  it("伪造来源和非原文引用不进入清单",()=>{
    expect(()=>prepareMaterial({...item,evidence:[{sourceId:"ch1",quote:"小满是十六岁的姑娘"}]},sources,[])).toThrow("未在正文中找到");
    expect(()=>prepareMaterial({...item,evidence:[{sourceId:"bad",quote:"小满"}]},sources,[])).toThrow();
  });
  it("歧义别名不静默合并",()=>{
    const existing:ExistingMaterial[]=[{kind:"character",id:"a",fields:{name:"小满"}},{kind:"character",id:"b",fields:{name:"林满",aliases:["小满"]}}];
    expect(()=>prepareMaterial(item,sources,existing)).toThrow("多张卡片");
  });
  it("拒绝模型偷塞权限字段",()=>{
    expect(()=>prepareMaterial({...item,fields:{...item.fields,aiVisible:false}},sources,[])).toThrow();
  });
});
