import {describe,it,expect} from "vitest";
import {worldRows} from "@/lib/editor/world-tree";
const cards=[{id:"国",parentId:null},{id:"州",parentId:"国"},{id:"城",parentId:"州"},{id:"书院",parentId:"城"},{id:"邻国",parentId:null}];
describe("设定目录折叠",()=>{
  it("按归属排序并保留层级",()=>expect(worldRows(cards).map(r=>[r.setting.id,r.depth])).toEqual([["国",0],["州",1],["城",2],["书院",3],["邻国",0]]));
  it("收起父级不会让后代作为孤立根重新出现",()=>expect(worldRows(cards,new Set(["国"])).map(r=>r.setting.id)).toEqual(["国","邻国"]));
  it("收起内部节点仍显示同级和祖先",()=>expect(worldRows(cards,new Set(["州"])).map(r=>r.setting.id)).toEqual(["国","州","邻国"]));
  it("丢失父级和循环的旧数据仍可查看",()=>{
    const rows=worldRows([{id:"孤立",parentId:"missing"},{id:"a",parentId:"b"},{id:"b",parentId:"a"}]);
    expect(new Set(rows.map(r=>r.setting.id)).size).toBe(3);
  });
});
