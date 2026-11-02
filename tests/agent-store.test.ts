import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentRun } from "@/lib/ai/agent/types";
import { diffBlocks } from "@/lib/diff/blocks";

const folder=mkdtempSync(join(tmpdir(),"yanfield-agent-"));
let repo:typeof import("@/lib/repo"),store:typeof import("@/lib/ai/agent/store"),db:typeof import("@/lib/db");
let novelId:string;
function task():AgentRun {
  const id=crypto.randomUUID();
  return {id,novelId,chapterId:null,request:"测试",status:"ready",summary:"候选",error:"",steps:[],changes:[],references:[],usage:{promptTokens:0,completionTokens:0,totalTokens:0,latencyMs:0},model:"test",provider:"test",preview:"",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
beforeAll(async()=>{
  process.env.YANFIELD_DB_PATH=join(folder,"test.db");
  repo=await import("@/lib/repo");store=await import("@/lib/ai/agent/store");db=await import("@/lib/db");
  novelId=repo.createNovel({title:"事务测试"}).id;
});
afterAll(()=>{db.getDb().close();delete process.env.YANFIELD_DB_PATH;rmSync(folder,{recursive:true,force:true});});

describe("Agent 暂存、应用和安全撤回",()=>{
  it("读取缺失章纲和总纲不会创建空行",()=>{
    const ch=repo.createChapter(novelId,{title:"只读"});
    expect(store.readEntity("blueprint",ch.id,novelId)).toBeNull();
    expect(store.readEntity("outline",novelId,novelId)).toBeNull();
    expect(db.get("SELECT id FROM chapter_blueprints WHERE chapter_id=?",[ch.id])).toBeUndefined();
  });
  it("暂存不落业务库，字段选择不会清空其他设定，重试不重复写入",()=>{
    const world=repo.createWorld(novelId,{title:"晚记",summary:"旧摘要",content:"不可拆信"});
    const run=task(),c=store.propose(run,"world",world.id,{summary:"新摘要",content:"新规则"},"完善边界");
    expect(repo.getWorld(world.id)?.summary).toBe("旧摘要");
    const result=store.applyChanges(run.id,[{id:c.id,fields:["summary"]}]);
    expect(result.changes[0].state).toBe("applied");
    expect(repo.getWorld(world.id)?.content).toBe("不可拆信");
    expect(repo.getWorld(world.id)?.summary).toBe("新摘要");
    expect(store.applyChanges(run.id,[{id:c.id}]).changes[0].state).toBe("applied");
    store.undoChanges(run.id);
    expect(repo.getWorld(world.id)?.summary).toBe("旧摘要");
  });
  it("批量中任意对象冲突会全部回滚，刷新后也能检测版本",()=>{
    const a=repo.createCharacter(novelId,{name:"周晚",identity:"记账人"});
    const b=repo.createWorld(novelId,{title:"闸口"});
    const run=task();
    const x=store.propose(run,"character",a.id,{identity:"收信人"},"改身份");
    const y=store.propose(run,"world",b.id,{summary:"河边"},"补摘要");
    repo.updateWorld(b.id,{summary:"作者刚写的"});
    expect(()=>store.applyChanges(run.id,[{id:x.id},{id:y.id}])).toThrow("已有修改");
    expect(repo.getCharacter(a.id)?.identity).toBe("记账人");
    expect(store.getRun(run.id).changes.every(c=>c.state==="pending")).toBe(true);
  });
  it("新章和章纲依赖正确，整轮撤回不会留下空壳",()=>{
    const run=task();
    const ch=store.propose(run,"chapter",null,{title:"第2章",content:"<p>河水退了。</p>"},"续写");
    const bp=store.propose(run,"blueprint",ch.id,{goal:"去闸口",targetWords:2000},"章纲","第2章章纲");
    expect(()=>store.applyChanges(run.id,[{id:bp.id}])).toThrow("先应用新章");
    const result=store.applyChanges(run.id,[{id:ch.id},{id:bp.id}]);
    const savedId=result.changes[0].appliedId!;
    expect(repo.getChapter(savedId)?.wordCount).toBe(4);
    expect(repo.getBlueprint(savedId).goal).toBe("去闸口");
    store.undoChanges(run.id);
    expect(repo.getChapter(savedId)).toBeUndefined();
    expect(db.get("SELECT id FROM chapter_blueprints WHERE chapter_id=?",[savedId])).toBeUndefined();
  });
  it("正文逐块选择由服务端重建，保留未接受的原文与格式",()=>{
    const ch=repo.createChapter(novelId,{title:"逐块",content:"<p><strong>第一段。</strong></p><p>第二段。</p>"});
    const after="<p>第一段改。</p><p>第二段改。</p>";
    const run=task(),c=store.propose(run,"chapter",ch.id,{content:after},"润色");
    const diff=diffBlocks(ch.content,after);
    store.applyChanges(run.id,[{id:c.id,blocks:[diff.items[1].id]}]);
    expect(repo.getChapter(ch.id)?.content).toBe("<p><strong>第一段。</strong></p><p>第二段改。</p>");
  });
  it("人工后续编辑使撤回失败，并保留人工内容",()=>{
    const ch=repo.createChapter(novelId,{title:"撤回保护",content:"<p>原文</p>"});
    const run=task(),c=store.propose(run,"chapter",ch.id,{content:"<p>候选</p>"},"改写");
    store.applyChanges(run.id,[{id:c.id}]);
    repo.updateChapter(ch.id,{content:"<p>人工续写</p>"});
    expect(()=>store.undoChanges(run.id)).toThrow("后续修改");
    expect(repo.getChapter(ch.id)?.content).toBe("<p>人工续写</p>");
  });
  it("拒绝跨作品对象、隐藏资料、不可写字段和同名重复创建",()=>{
    const other=repo.createNovel({title:"别的书"});
    const foreign=repo.createCharacter(other.id,{name:"其他人"});
    const hidden=repo.createWorld(novelId,{title:"隐藏",aiVisible:false});
    expect(()=>store.propose(task(),"character",foreign.id,{identity:"修改"},"test")).toThrow("不属于");
    expect(()=>store.visibleEntity("world",hidden.id,novelId)).toThrow("隐藏");
    expect(()=>store.propose(task(),"world",hidden.id,{aiVisible:true},"test")).toThrow();
    repo.createCharacter(novelId,{name:"小满"});
    const run=task(),c=store.propose(run,"character",null,{name:"小满",identity:"跑腿"},"补卡");
    expect(()=>store.applyChanges(run.id,[{id:c.id}])).toThrow("已存在");
  });
  it("显式清空字段会被保留；父级循环被拒绝",()=>{
    const a=repo.createWorld(novelId,{title:"父",summary:"待清空"});
    const b=repo.createWorld(novelId,{title:"子",parentId:a.id});
    const run=task(),c=store.propose(run,"world",a.id,{summary:""},"清空");
    store.applyChanges(run.id,[{id:c.id}]);expect(repo.getWorld(a.id)?.summary).toBe("");
    const run2=task(),c2=store.propose(run2,"world",a.id,{parentId:b.id},"改父级");
    expect(()=>store.applyChanges(run2.id,[{id:c2.id}])).toThrow("循环");
  });
});
