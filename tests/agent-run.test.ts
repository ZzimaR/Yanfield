import { afterAll,beforeAll,describe,expect,it,vi } from "vitest";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import type {AiStreamEvent} from "@/lib/types";
const fake=vi.hoisted(()=>({queue:[] as string[],inputs:[] as unknown[],cache:[] as (number|undefined)[],costs:[] as ({amount:number;currency:"USD"|"CNY"}|undefined)[]}));
vi.mock("@/lib/ai/provider",()=>({streamCompletion:async function*(input:unknown){
  fake.inputs.push(input);
  const value=fake.queue.shift();if(value===undefined)throw new Error("unexpected call");
  const sourceId=value.includes("__SOURCE_ID__")?JSON.parse((input as {messages:{content:string}[]}).messages[1].content).sources[0].id:"";
  yield {type:"delta",text:value.replaceAll("__SOURCE_ID__",sourceId)};yield {type:"usage",promptTokens:10,completionTokens:5,cachedInputTokens:fake.cache.shift(),cost:fake.costs.shift()};
}}));
vi.mock("@/lib/ai/engine",()=>({resolveTarget:()=>({provider:{id:"test",name:"test",kind:"openai"},model:"test"}),mergeContextConfig:(c:unknown)=>({contextBudget:24000,includeCharacters:true,includeWorld:true,includeForeshadows:true,includeArchives:true,includeNovelOutline:true,includeVolumeOutline:true,includeChapterBlueprint:true,includeStyleGuide:true,includeSelection:true,...(c as object)})}));
const folder=mkdtempSync(join(tmpdir(),"yanfield-run-"));
let repo:typeof import("@/lib/repo"),runtime:typeof import("@/lib/ai/agent/run"),store:typeof import("@/lib/ai/agent/store");
beforeAll(async()=>{process.env.YANFIELD_DB_PATH=join(folder,"test.db");repo=await import("@/lib/repo");runtime=await import("@/lib/ai/agent/run");store=await import("@/lib/ai/agent/store");});
afterAll(async()=>{(await import("@/lib/db")).getDb().close();delete process.env.YANFIELD_DB_PATH;rmSync(folder,{recursive:true,force:true});});
async function collect(request:Parameters<typeof runtime.runAgent>[0],signal?:AbortSignal){const events:AiStreamEvent[]=[];for await(const e of runtime.runAgent(request,signal))events.push(structuredClone(e));return events;}
const plan=(calls:unknown[],message="处理任务")=>JSON.stringify({message,calls,done:!calls.length});

describe("Agent连续工具执行",()=>{
  it("累计缓存统计、未报告调用和日志持久化不会重复计算输入",async()=>{
    const novel=repo.createNovel({title:"缓存统计"});
    fake.cache=[8,undefined];fake.queue=[plan([{name:"workspace",args:{}}]),plan([],"完成")];
    const event=(await collect({novelId:novel.id,message:"检查进度"})).filter(e=>e.type==="agent").at(-1)!;
    if(event.type!=="agent")throw new Error("missing");
    expect(event.run.usage).toMatchObject({promptTokens:20,cachedInputTokens:8,cacheReportedInputTokens:10});
    expect(store.getRun(event.run.id).usage.cachedInputTokens).toBe(8);
    expect(repo.getStats().aiCachedInputTokens).toBeGreaterThanOrEqual(8);
  });

  it("DSML 工具封套转成同一套经过校验的调用，不额外请求修复",async()=>{
    const novel=repo.createNovel({title:"DSML 兼容"});
    fake.queue=['<｜｜DSML｜｜ calls><｜｜DSML｜｜ invoke name="workspace"><｜｜DSML｜｜ parameter name="args" string="false">{}</｜｜DSML｜｜ parameter></｜｜DSML｜｜ invoke></｜｜DSML｜｜ calls>',plan([],"已查看")];
    const event=(await collect({novelId:novel.id,message:"查看作品"})).filter(e=>e.type==="agent").at(-1)!;
    if(event.type!=="agent")throw new Error("missing");
    expect(event.run.status).toBe("complete");expect(event.run.steps[0].tool).toBe("workspace");expect(event.run.diagnostics).toBeUndefined();
  });

  it("合法的8项批量读取不再因旧的5项上限被拒绝",async()=>{
    const novel=repo.createNovel({title:"批量资料"});
    const cards=Array.from({length:8},(_,i)=>repo.createCharacter(novel.id,{name:`人物${i}`}));
    fake.queue=[plan(cards.map(c=>({name:"read",args:{kind:"character",id:c.id}}))),plan([],"已读取八张资料卡")];
    const events=await collect({novelId:novel.id,message:"读这些角色"});
    const event=events.filter(e=>e.type==="agent").at(-1)!;
    if(event.type!=="agent")throw new Error("missing");
    expect(event.run.status).toBe("complete");expect(event.run.references).toHaveLength(8);expect(event.run.diagnostics).toBeUndefined();
  });
  it("修复时不回灌损坏DSML，成功调用归一成JSON后继续",async()=>{
    const novel=repo.createNovel({title:"协议污染"});fake.inputs=[];
    const bad='<｜｜DSML｜｜ calls><｜｜DSML｜｜ invoke name="workspace">broken';
    const valid='<｜｜DSML｜｜ calls><｜｜DSML｜｜ invoke name="workspace"><｜｜DSML｜｜ parameter name="args" string="false">{}</｜｜DSML｜｜ parameter></｜｜DSML｜｜ invoke></｜｜DSML｜｜ calls>';
    fake.queue=[bad,valid,plan([],"完成")];
    const events=await collect({novelId:novel.id,message:"按建议读取",history:[{role:"assistant",content:"建议先核对设定。"}]});
    const event=events.filter(e=>e.type==="agent").at(-1)!;
    if(event.type!=="agent")throw new Error("missing");
    expect(event.run.status).toBe("complete");expect(event.run.diagnostics).toHaveLength(1);
    const messages=(fake.inputs.at(-1) as {messages:{role:string;content:string}[]}).messages;
    expect(messages.some(m=>m.content===bad||m.content===valid)).toBe(false);
    for(const message of messages.filter(m=>m.role==="assistant"))expect(()=>JSON.parse(message.content)).not.toThrow();
  });
  it("JSON模式空白返回进入修复而非跳过修复直接报错",async()=>{
    const novel=repo.createNovel({title:"空白修复"});fake.queue=["   ",plan([],"已恢复")];
    const events=await collect({novelId:novel.id,message:"分析"});const event=events.filter(e=>e.type==="agent").at(-1)!;
    if(event.type!=="agent")throw new Error("missing");expect(event.run.status).toBe("complete");expect(event.run.diagnostics).toHaveLength(1);
  });

  it("进展顺序追加、连续重复去重，并随任务持久化",async()=>{
    const novel=repo.createNovel({title:"进展记录"});
    fake.queue=[plan([{name:"workspace",args:{}}],"先查看作品进度。"),plan([{name:"workspace",args:{}}],"先查看作品进度。"),plan([],"已核对作品进度。")];
    const events=(await collect({novelId:novel.id,message:"查看进度"})).filter(e=>e.type==="agent");
    const last=events.at(-1)!;
    if(last.type!=="agent")throw new Error("missing");
    expect(last.run.progress?.map(p=>[p.text,p.stepIndex])).toEqual([["先查看作品进度。",0],["已核对作品进度。",2]]);
    expect(store.getRun(last.run.id).progress).toEqual(last.run.progress);
    expect(events.filter(e=>e.type==="agent").every(e=>e.run.progress?.[0]?.text==="先查看作品进度。" || !e.run.progress?.length)).toBe(true);
  });

  it("长说明不使有效工具指令被拒绝",async()=>{
    const novel=repo.createNovel({title:"长说明"});
    fake.queue=[plan([{name:"workspace",args:{}}],"长篇资料说明。".repeat(400)),plan([],"完成")];
    const event=(await collect({novelId:novel.id,message:"查看作品"})).filter(e=>e.type==="agent").at(-1)!;
    if(event.type!=="agent")throw new Error("missing");expect(event.run.status).toBe("complete");expect(event.run.diagnostics).toBeUndefined();
  });
  it("两次失败持久化错误码、轮次、结构错误及脱敏片段",async()=>{
    const novel=repo.createNovel({title:"诊断"});
    fake.queue=["不是JSON sk-fakeDiagnosticToken12345",JSON.stringify({message:123,calls:[]})];
    const event=(await collect({novelId:novel.id,message:"查看作品"})).filter(e=>e.type==="agent").at(-1)!;
    if(event.type!=="agent")throw new Error("missing");
    expect(event.run.errorCode).toBe("AGENT_PROTOCOL_INVALID");expect(event.run.error).toContain("本轮尚未生成新候选");
    const saved=store.getRun(event.run.id);expect(saved.diagnostics).toHaveLength(2);
    expect(saved.diagnostics?.[0]).toMatchObject({code:"AGENT_JSON_INVALID",round:1,attempt:1});
    expect(saved.diagnostics?.[1]).toMatchObject({code:"AGENT_SCHEMA_INVALID",round:1,attempt:2,issues:[{path:"message",code:"invalid_type"}]});
    expect(JSON.stringify(saved.diagnostics)).not.toContain("sk-fakeDiagnosticToken12345");
  });

  it("生成候选后遗漏 done 标记的总结正常结束",async()=>{
    const novel=repo.createNovel({title:"完成判定"});
    fake.queue=[plan([{name:"propose",args:{kind:"world",fields:{title:"澜国",content:"西面临海。"},reason:"按材料建卡"}}]),JSON.stringify({message:"已准备澜国设定，请确认应用。",calls:[]})];
    const event=(await collect({novelId:novel.id,message:"新建澜国卡片"})).filter(e=>e.type==="agent").at(-1)!;
    if(event.type!=="agent")throw new Error("missing");
    expect(event.run.status).toBe("ready");expect(event.run.error).toBe("");expect(event.run.changes).toHaveLength(1);
    expect(repo.listWorld(novel.id)).toHaveLength(0);
  });
  it("无工具的普通讨论无需 done 标记",async()=>{
    const novel=repo.createNovel({title:"普通讨论"});
    fake.queue=[JSON.stringify({message:"可以从沿海气候展开。",calls:[],done:false})];
    const event=(await collect({novelId:novel.id,message:"讨论气候"})).filter(e=>e.type==="agent").at(-1)!;
    if(event.type!=="agent")throw new Error("missing");
    expect(event.run.status).toBe("complete");expect(event.run.error).toBe("");
  });
  it("空白回复且没有工具仍报错",async()=>{
    const novel=repo.createNovel({title:"空白返回"});
    fake.queue=[JSON.stringify({message:" ",calls:[],done:false})];
    const event=(await collect({novelId:novel.id,message:"新建设定"})).filter(e=>e.type==="agent").at(-1)!;
    if(event.type!=="agent")throw new Error("missing");
    expect(event.run.status).toBe("error");expect(event.run.error).toBe("模型没有给出下一步操作");
  });

  it.each([0,32000,64000])("主编遵循用户输出上限 %i，不再写死内部额度",async(maxTokens)=>{
    const novel=repo.createNovel({title:"用户输出上限"});
    fake.inputs=[];
    fake.queue=[plan([{name:"write_chapter",args:{title:"第一章",instruction:"河边",words:2000}}]),"河水退了。",plan([],"等待确认"),JSON.stringify({cards:[]})];
    await collect({novelId:novel.id,message:"写第一章",context:{maxTokens}});
    expect(fake.inputs).toHaveLength(4);
    for(const input of fake.inputs)expect((input as {maxTokens?:number}).maxTokens).toBe(maxTokens||undefined);
  });

  it("不增加资料及后续无附加要求的追问不会触发资料整理",async()=>{
    const novel=repo.createNovel({title:"不增加资料"}),chapter=repo.createChapter(novel.id,{title:"第一章",content:"<p>林舟收起信。</p>"});
    fake.queue=[plan([{name:"read",args:{kind:"chapter",id:chapter.id}}]),plan([{name:"write_chapter",args:{id:chapter.id,instruction:"润色"}}]),"林舟把信收进袖中。",plan([],"候选待确认")];
    const events=await collect({novelId:novel.id,chapterId:chapter.id,message:"润色本章，不增加资料"});
    const first=events.filter(e=>e.type==="agent").at(-1)!;if(first.type!=="agent")throw new Error("missing");
    expect(first.run.materialPolicy).toBe("skip");expect(first.run.steps.some(s=>s.tool==="organize_materials")).toBe(false);
    fake.queue=[plan([],"暂不继续修改")];
    const follow=(await collect({novelId:novel.id,chapterId:chapter.id,message:"再短一点",previousRunId:first.run.id})).filter(e=>e.type==="agent").at(-1)!;
    if(follow.type!=="agent")throw new Error("missing");expect(follow.run.materialPolicy).toBe("skip");
  });

  it("小选区目标按原句计，不强制100/2000字，且只替换选中短语",async()=>{
    const novel=repo.createNovel({title:"短选区"}),chapter=repo.createChapter(novel.id,{title:"第一章",content:"<p>林舟把信压在账本下。</p>"});fake.inputs=[];
    fake.queue=[plan([{name:"read",args:{kind:"chapter",id:chapter.id}}]),plan([{name:"write_chapter",args:{id:chapter.id,mode:"selection",instruction:"只润色选中短语"}}]),"将信压在账本下",plan([],"候选待确认")];
    const events=await collect({novelId:novel.id,chapterId:chapter.id,message:"只润色这句",selection:"把信压在账本下"});
    const event=events.filter(e=>e.type==="agent").at(-1)!;if(event.type!=="agent")throw new Error("missing");
    expect(event.run.changes[0].after.content).toBe("<p>林舟将信压在账本下。</p>");
    const writer=fake.inputs.find(i=>(i as {messages:{content:string}[]}).messages[0].content.startsWith("你是小说写手")) as {messages:{content:string}[]};
    expect(JSON.parse(writer.messages.at(-1)!.content).targetWords).toBe("把信压在账本下".length);
  });
  it("关闭选区上下文后忽略客户端仍传入的选中文本",async()=>{
    const novel=repo.createNovel({title:"关闭选区"});
    fake.inputs=[];fake.queue=[plan([],"只按文字要求回答")];
    await collect({
      novelId:novel.id,
      message:"简单回答",
      selection:"不应发送的选中正文",
      context:{includeSelection:false},
    });
    const messages=(fake.inputs[0] as {messages:{role:string;content:string}[]}).messages;
    expect(messages.at(-1)?.content).not.toContain("不应发送的选中正文");
  });
  it("不限预算时仍允许写手生成正文",async()=>{
    const novel=repo.createNovel({title:"不限预算写作"});
    fake.queue=[
      plan([{name:"write_chapter",args:{instruction:"写一个简短开篇",words:100}}]),
      "潮水退了。",
      plan([],"正文候选已准备好"),
    ];
    const events=await collect({
      novelId:novel.id,
      message:"写一个简短开篇，不增加资料",
      context:{contextBudget:0},
    });
    const event=events.filter((item)=>item.type==="agent").at(-1)!;
    if(event.type!=="agent")throw new Error("missing");
    expect(event.run.status).toBe("ready");
    expect(event.run.changes).toHaveLength(1);
  });
  it("工作区档案排除当前章及后续章节",async()=>{
    const novel=repo.createNovel({title:"档案时序"});
    const previous=repo.createChapter(novel.id,{title:"第一章"});
    const current=repo.createChapter(novel.id,{title:"第二章"});
    const future=repo.createChapter(novel.id,{title:"第三章"});
    const previousArchive=repo.upsertArchive({novelId:novel.id,chapterId:previous.id,chapterSummary:"先前已发生剧情"});
    repo.upsertArchive({novelId:novel.id,chapterId:future.id,chapterSummary:"尚未发生剧情"});
    fake.inputs=[];
    fake.queue=[plan([{name:"workspace",args:{}}]),plan([],"查看完成")];
    await collect({novelId:novel.id,chapterId:current.id,message:"核对档案"});
    const messages=(fake.inputs[1] as {messages:{content:string}[]}).messages;
    const workspace=messages.find((item)=>item.content.startsWith("工具 workspace 返回："))?.content ?? "";
    expect(workspace).toContain(previousArchive.chapterSummary);
    expect(workspace).not.toContain("尚未发生剧情");

    fake.inputs=[];
    fake.queue=[plan([{name:"read_archive",args:{chapterId:future.id}}]),plan([],"已跳过未发生的档案")];
    await collect({novelId:novel.id,chapterId:current.id,message:"核对档案"});
    const readMessages=(fake.inputs[1] as {messages:{content:string}[]}).messages;
    expect(readMessages.some((item)=>item.content.includes("不能读取当前章节之后的故事档案"))).toBe(true);
  });
  it("重复或跨格式的选区先拒绝，不调用写手浪费token",async()=>{
    const novel=repo.createNovel({title:"重复选区"}),chapter=repo.createChapter(novel.id,{title:"第一章",content:"<p>信在账本下。</p><p>信在账本下。</p>"});fake.inputs=[];
    fake.queue=[plan([{name:"read",args:{kind:"chapter",id:chapter.id}}]),plan([{name:"write_chapter",args:{id:chapter.id,mode:"selection",instruction:"润色"}}]),plan([],"选区重复，请重新选择")];
    const events=await collect({novelId:novel.id,chapterId:chapter.id,message:"润色这句",selection:"信在账本下"});
    const event=events.filter(e=>e.type==="agent").at(-1)!;if(event.type!=="agent")throw new Error("missing");
    expect(event.run.changes).toHaveLength(0);expect(fake.inputs).toHaveLength(3);expect(event.run.steps.at(-1)?.status).toBe("error");
  });

  it("同轮追加再打磨替换新增部分，不把两版连在一起，统计区分新增与全章",async()=>{
    const novel=repo.createNovel({title:"追加版本"}),chapter=repo.createChapter(novel.id,{title:"第一章",content:"<p>不可修改的原文。</p>"});fake.inputs=[];
    const write=(instruction:string)=>plan([{name:"write_chapter",args:{id:chapter.id,mode:"append",instruction,words:100}}]);
    fake.queue=[plan([{name:"read",args:{kind:"chapter",id:chapter.id}}]),write("先续写"),"首版新增段落。",write("只把本轮新增部分重写"),"新版新增。",plan([],"候选待确认")];
    const events=await collect({novelId:novel.id,chapterId:chapter.id,message:"在末尾追加，不增加资料"});
    const event=events.filter(e=>e.type==="agent").at(-1)!;if(event.type!=="agent")throw new Error("missing");
    expect(event.run.changes).toHaveLength(1);expect(event.run.changes[0].after.content).toBe(chapter.content+"<p>新版新增。</p>");
    const writers=fake.inputs.filter(i=>(i as {messages:{content:string}[]}).messages[0].content.startsWith("你是小说写手")) as {messages:{content:string}[]}[];
    expect(JSON.parse(writers[1].messages[2].content).current.content).toBe(chapter.content);
    expect(JSON.parse(writers[1].messages.at(-1)!.content).appendDraft).toBe("<p>首版新增段落。</p>");
    const messages=(fake.inputs.at(-1) as {messages:{content:string}[]}).messages;
    const result=JSON.parse(messages.filter(m=>m.content.startsWith("工具 write_chapter 返回：")).at(-1)!.content.split("\n当前候选")[0].split("返回：")[1]);
    expect(result).toMatchObject({generatedWords:4,words:11,targetWords:100,ratio:4});
  });

  it("模型漏给新章标题时按实际目录给出章号，不回执第三章却创建新章节",async()=>{
    const novel=repo.createNovel({title:"章节编号"});repo.createChapter(novel.id,{title:"第一章"});repo.createChapter(novel.id,{title:"第二章"});
    fake.queue=[plan([{name:"write_chapter",args:{instruction:"续写下一章",words:100}}]),"天亮后，林舟回到渡口。",plan([],"候选待确认")];
    const events=await collect({novelId:novel.id,message:"续写下一章，不增加资料"});const event=events.filter(e=>e.type==="agent").at(-1)!;
    if(event.type!=="agent")throw new Error("missing");expect(event.run.changes[0].title).toBe("第 3 章");expect(event.run.changes[0].after.title).toBe("第 3 章");
  });

  it("重试复用助手消息，刷新历史不增加提问或回复",async()=>{
    const novel=repo.createNovel({title:"原位重试"}),session=repo.createChatSession(novel.id,{});
    fake.queue=["invalid", "invalid"];
    const first=(await collect({novelId:novel.id,sessionId:session.id,message:"新建设定"})).filter(e=>e.type==="agent").at(-1)!;
    if(first.type!=="agent")throw new Error("missing");
    expect(first.run.status).toBe("error");
    const messages=repo.listMessages(session.id);
    fake.queue=[plan([],"重试完成")];
    const second=(await collect({novelId:novel.id,sessionId:session.id,message:"新建设定",previousRunId:first.run.id,retryRunId:first.run.id})).filter(e=>e.type==="agent").at(-1)!;
    if(second.type!=="agent")throw new Error("missing");
    const saved=repo.listMessages(session.id);
    expect(saved).toHaveLength(2);
    expect(saved.map(m=>m.id)).toEqual(messages.map(m=>m.id));
    expect(saved[1].content).toBe("重试完成");
    expect(saved[1].actions[0].id).toBe(second.run.id);
    expect(store.getRun(first.run.id).status).toBe("error");
  });
  it("跨会话重试被拒绝，不写入重复消息",async()=>{
    const novel=repo.createNovel({title:"重试校验"}),a=repo.createChatSession(novel.id,{}),b=repo.createChatSession(novel.id,{});
    fake.queue=[plan([],"完成")];
    const first=(await collect({novelId:novel.id,sessionId:a.id,message:"查看"})).filter(e=>e.type==="agent").at(-1)!;
    if(first.type!=="agent")throw new Error("missing");
    await expect(collect({novelId:novel.id,sessionId:b.id,message:"查看",retryRunId:first.run.id})).rejects.toThrow("重试任务与会话不匹配");
    expect(repo.listMessages(b.id)).toHaveLength(0);
  });

  it("完整接口费用按调用求和，缺失任一调用费用时只算部分返回",async()=>{
    const novel=repo.createNovel({title:"费用来源"});
    fake.queue=[plan([{name:"workspace",args:{}}]),plan([],"完成")];fake.costs=[{amount:0.01,currency:"USD"},{amount:0.02,currency:"USD"}];
    let events=await collect({novelId:novel.id,message:"查看进度"});
    let final=events.filter(e=>e.type==="agent").at(-1)!;if(final.type!=="agent")throw new Error("missing");
    expect(final.run.usage.reportedCost).toEqual({amount:0.03,currency:"USD",complete:true});
    fake.queue=[plan([{name:"workspace",args:{}}]),plan([],"完成")];fake.costs=[{amount:0.01,currency:"USD"},undefined];
    events=await collect({novelId:novel.id,message:"查看进度"});final=events.filter(e=>e.type==="agent").at(-1)!;if(final.type!=="agent")throw new Error("missing");
    expect(final.run.usage.reportedCost).toEqual({amount:0.01,currency:"USD",complete:false});
  });
  it("追问待确认设定会修订原候选，旧清单失效，正文保持不动",async()=>{
    const novel=repo.createNovel({title:"连续修改"}),world=repo.createWorld(novel.id,{title:"晚记",summary:"旧摘要"});
    const previous={id:crypto.randomUUID(),novelId:novel.id,chapterId:null,request:"完善设定",status:"ready" as const,summary:"已准备",error:"",steps:[],changes:[],references:[],usage:{promptTokens:0,completionTokens:0,totalTokens:0,latencyMs:0},model:"test",provider:"test",preview:"",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    const draft=store.propose(previous,"world",world.id,{summary:"首版摘要"},"首次修改");
    fake.queue=[plan([{name:"read",args:{kind:"world",id:draft.id}}]),plan([{name:"propose",args:{kind:"world",id:draft.id,fields:{summary:"修订后的摘要"},reason:"按追问修订"}}]),plan([],"新版等待确认")];
    const events=await collect({novelId:novel.id,message:"这版摘要再简洁一点",previousRunId:previous.id});
    const final=events.filter(e=>e.type==="agent").at(-1)!;if(final.type!=="agent")throw new Error("missing");
    expect(final.run.changes).toHaveLength(1);expect(final.run.changes[0].after.summary).toBe("修订后的摘要");
    expect(store.getRun(previous.id).changes[0].state).toBe("rejected");expect(repo.getWorld(world.id)?.summary).toBe("旧摘要");
    store.applyChanges(final.run.id,[{id:final.run.changes[0].id}]);expect(repo.getWorld(world.id)?.summary).toBe("修订后的摘要");
  });
  it("关闭某类上下文后，工具无法绕过开关读取",async()=>{
    const novel=repo.createNovel({title:"上下文权限"}),world=repo.createWorld(novel.id,{title:"不应读取",content:"secret"});
    fake.queue=[plan([{name:"read",args:{kind:"world",id:world.id}}]),plan([],"该类资料已关闭")];
    const events=await collect({novelId:novel.id,message:"读设定",context:{includeWorld:false}});
    const final=events.filter(e=>e.type==="agent").at(-1)!;if(final.type!=="agent")throw new Error("missing");
    expect(final.run.steps[0].status).toBe("error");expect(final.run.references).toHaveLength(0);
  });
  it("读取卡片后提出具体字段修改，保存会话回执但不改业务数据",async()=>{
    const novel=repo.createNovel({title:"修改设定"}),card=repo.createWorld(novel.id,{title:"晚记",content:"不拆信"}),session=repo.createChatSession(novel.id,{});
    fake.queue=[plan([{name:"read",args:{kind:"world",id:card.id}}]),plan([{name:"propose",args:{kind:"world",id:card.id,fields:{summary:"渡口的收信铺"},reason:"补摘要"}}]),plan([],"准备好一项摘要修改，等待确认。")];
    const events=await collect({novelId:novel.id,sessionId:session.id,message:"补一下晚记的摘要"});
    const final=events.filter(e=>e.type==="agent").at(-1)!;
    expect(final.type).toBe("agent");if(final.type!=="agent")return;
    expect(final.run.status).toBe("ready");expect(final.run.changes).toHaveLength(1);
    expect(repo.getWorld(card.id)?.summary).toBe("");
    expect(repo.listMessages(session.id).at(-1)?.actions[0].type).toBe("agent-run");
    expect(repo.listMessages(session.id).at(-1)?.status).toBe("complete");
    expect(final.run.usage.totalTokens).toBe(45);
    expect(final.run.steps[0].targets).toEqual([{kind:"world",id:card.id,title:"晚记"}]);
    expect(final.run.steps[1].targets?.[0]).toMatchObject({kind:"world",title:"晚记",changeId:final.run.changes[0].id});
    expect(final.run.steps[0].detail).not.toBe("处理任务");

  });
  it("写手候选可以被下一步读取并自检，修订不会重复建章",async()=>{
    const novel=repo.createNovel({title:"新章"});
    // The mock can inspect prior tool results to refer to a generated candidate ID.
    fake.queue=[plan([{name:"workspace",args:{}}]),plan([{name:"write_chapter",args:{title:"第1章",instruction:"河边收信",words:2000}}]),"河水退了。\n周晚收起信。",plan([],"候选已完成，等待确认。"),JSON.stringify({cards:[]})];
    const events=await collect({novelId:novel.id,message:"写第一章"});
    const final=events.filter(e=>e.type==="agent").at(-1)!;
    if(final.type!=="agent")throw new Error("missing");
    expect(final.run.changes).toHaveLength(1);expect(repo.listChapters(novel.id)).toHaveLength(0);
    expect(events.some(e=>e.type==="agent-preview")).toBe(true);
    expect(final.run.changes[0].after.content).toBe("<p>河水退了。</p><p>周晚收起信。</p>");
    expect(final.run.steps.at(-1)?.label).toBe("整理正文资料");
  });
  it("写完自动整理角色，别名去重、拒绝伪引用，确认后才能入库",async()=>{
    const novel=repo.createNovel({title:"自动建卡"});
    const existing=repo.createCharacter(novel.id,{name:"林小满",aliases:["小满"],identity:"作者设定的送信人"});
    fake.queue=[plan([{name:"write_chapter",args:{title:"第一章",instruction:"收信"}}]),"小满每天替周晚送信，从不拆信。",plan([],"等待确认"),JSON.stringify({cards:[
      {kind:"character",fields:{name:"小满",identity:"新的身份",personality:"从不拆信"},evidence:[{sourceId:"__SOURCE_ID__",quote:"小满每天替周晚送信，从不拆信。"}]},
      {kind:"character",fields:{name:"周晚",identity:"收信人"},evidence:[{sourceId:"__SOURCE_ID__",quote:"替周晚送信"}]},
      {kind:"world",fields:{title:"不存在的地点",summary:"模型编造"},evidence:[{sourceId:"__SOURCE_ID__",quote:"不存在的地点"}]}
    ]})];
    const events=await collect({novelId:novel.id,message:"写一章"});
    const final=events.filter(e=>e.type==="agent").at(-1)!;if(final.type!=="agent")throw new Error("missing");
    expect(final.run.status).toBe("ready");expect(final.run.changes).toHaveLength(3);
    const update=final.run.changes.find(c=>c.targetId===existing.id)!;
    expect(update.after).toEqual({personality:"从不拆信"});
    expect(repo.listCharacters(novel.id)).toHaveLength(1);expect(repo.listChapters(novel.id)).toHaveLength(0);
    expect(final.run.steps.at(-1)?.detail).toContain("1 项未通过");
    store.applyChanges(final.run.id,final.run.changes.map(c=>({id:c.id})));
    expect(repo.listCharacters(novel.id)).toHaveLength(2);expect(repo.getCharacter(existing.id)?.identity).toBe("作者设定的送信人");
    expect(repo.getCharacter(existing.id)?.personality).toBe("从不拆信");
    store.undoChanges(final.run.id);expect(repo.listCharacters(novel.id)).toHaveLength(1);expect(repo.listChapters(novel.id)).toHaveLength(0);
    expect(repo.getCharacter(existing.id)?.personality).toBe("");
  });
  it("资料整理失败保留正文，且明确报告未完成",async()=>{
    const novel=repo.createNovel({title:"提取失败"});
    fake.queue=[plan([{name:"write_chapter",args:{title:"第一章",instruction:"收信"}}]),"周晚收起信。",plan([],"等待确认"),"invalid","invalid"];
    const events=await collect({novelId:novel.id,message:"写一章"});
    const final=events.filter(e=>e.type==="agent").at(-1)!;if(final.type!=="agent")throw new Error("missing");
    expect(final.run.status).toBe("ready");expect(final.run.changes).toHaveLength(1);
    expect(final.run.summary).toContain("资料整理未完成");expect(final.run.steps.at(-1)?.status).toBe("error");
  });
  it("作者只写正文时不额外调用资料整理",async()=>{
    const novel=repo.createNovel({title:"只写正文"});
    fake.queue=[plan([{name:"write_chapter",args:{title:"第一章",instruction:"收信"}}]),"周晚收起信。",plan([],"等待确认")];
    const events=await collect({novelId:novel.id,message:"只写正文，不要建卡"});
    const final=events.filter(e=>e.type==="agent").at(-1)!;if(final.type!=="agent")throw new Error("missing");
    expect(final.run.status).toBe("ready");expect(final.run.steps).toHaveLength(1);
  });
  it("结构输出失败重试一次后明确失败，不悄悄改成另一个任务",async()=>{
    const novel=repo.createNovel({title:"错误"});fake.queue=["not json","not json"];
    const events=await collect({novelId:novel.id,message:"补设定"});const final=events.filter(e=>e.type==="agent").at(-1)!;
    if(final.type!=="agent")throw new Error("missing");
    expect(final.run.status).toBe("error");expect(final.run.error).toContain("两次");expect(final.run.changes).toHaveLength(0);
  });
  it("取消会保存运行状态，后续能读取，不产生正文空壳",async()=>{
    const novel=repo.createNovel({title:"停止"}),controller=new AbortController();controller.abort();fake.queue=[];
    const events=await collect({novelId:novel.id,message:"续写"},controller.signal);const final=events.filter(e=>e.type==="agent").at(-1)!;
    if(final.type!=="agent")throw new Error("missing");
    expect(store.getRun(final.run.id).status).toBe("aborted");expect(repo.listChapters(novel.id)).toHaveLength(0);
  });
});
