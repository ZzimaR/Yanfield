"use client";
import * as React from "react";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { Button } from "@/components/ui/kit";
import { diffBlocks, splitBlocks, type BlockChange } from "@/lib/diff/blocks";
import { useEditorBridge } from "@/lib/editor/bridge";
import { apiGet } from "@/lib/client/api";
import { commitAgent } from "@/lib/ai/agent/client";
import type { AgentRun } from "@/lib/ai/agent/types";

export function AgentReview({initial,changeId,onClose}:{initial:AgentRun;changeId:string;onClose:()=>void}) {
  const [run,setRun]=React.useState(initial),[kept,setKept]=React.useState<Set<string>|null>(null);
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(""),[active,setActive]=React.useState(0);
  const bridge=useEditorBridge();
  const root=React.useRef<HTMLDivElement>(null);
  React.useEffect(()=>{void apiGet<AgentRun>(`/api/ai/agent/${initial.id}`).then(setRun).catch(e=>setError(e.message));},[initial.id]);
  const change=run.changes.find(c=>c.id===changeId);
  const before=String(change?.before?.content||""),after=String(change?.after.content||"");
  const diff=React.useMemo(()=>diffBlocks(before,after),[before,after]);
  const selected=kept??new Set(diff.items.map(c=>c.id));
  const pending=change?.state==="pending";
  const jump=(index:number)=>{const next=(index+diff.items.length)%diff.items.length;setActive(next);root.current?.querySelector(`[data-change-index="${next}"]`)?.scrollIntoView({behavior:"smooth",block:"center"});};
  const choose=(id:string,yes:boolean)=>{const next=new Set(selected);if(yes)next.add(id);else next.delete(id);setKept(next);};
  const renderChange=(item:BlockChange)=>{
    const index=diff.items.indexOf(item),accept=selected.has(item.id);
    return <section key={item.id} data-change-index={index} className={`my-4 rounded-lg border px-3 py-2.5 ${active===index?"border-jade/50":"border-line"} ${!accept?"opacity-60":""}`}>
      <div className="mb-2 flex items-center gap-2 font-sans text-[10px] text-ink-3"><span>AI 改动 · 第 {index+1}/{diff.items.length} 处</span>{pending?<div className="ml-auto flex gap-1"><button type="button" disabled={busy} aria-pressed={accept} className={`rounded px-2 py-1 ${accept?"bg-jade/10 text-jade":"bg-surface-2"}`} onClick={()=>choose(item.id,true)}>✓ 保留</button><button type="button" disabled={busy} aria-pressed={!accept} className={`rounded px-2 py-1 ${!accept?"bg-danger/10 text-danger":"bg-surface-2"}`} onClick={()=>choose(item.id,false)}>还原</button></div>:<span className="ml-auto">历史记录</span>}</div>
      {item.beforeText?<p className="mb-2 whitespace-pre-wrap rounded bg-danger/5 px-2 py-1.5 text-ink-3">{item.inline?item.inline.filter(s=>s.type!=="add").map((s,i)=><span key={i} className={s.type==="del"?"bg-danger/15 text-danger line-through":""}>{s.text}</span>):<del>{item.beforeText}</del>}</p>:null}
      {item.afterText?<p className="whitespace-pre-wrap rounded bg-jade/5 px-2 py-1.5">{item.inline?item.inline.filter(s=>s.type!=="del").map((s,i)=><span key={i} className={s.type==="add"?"bg-jade/15 text-jade":""}>{s.text}</span>):<span className="bg-jade/15 text-jade">{item.afterText}</span>}</p>:null}
    </section>;
  };
  const blocks=splitBlocks(before),byId=new Map(diff.items.filter(c=>c.type!=="added").map(c=>[c.id,c]));
  const additions=(anchor:string|null)=>diff.items.filter(c=>c.type==="added"&&c.anchorId===anchor).map(renderChange);
  const apply=async()=>{
    if(!change||busy)return;setBusy(true);setError("");
    try {await commitAgent(run.id,{selections:[{id:change.id,blocks:[...selected]}]},bridge);onClose();}
    catch(e){setError(e instanceof Error?e.message:"应用失败");}finally{setBusy(false);}
  };
  return <div ref={root} data-testid="agent-inline-review" className="ai-surface pb-8">
    <div className="sticky top-0 z-20 -mx-2 mb-6 rounded-lg border border-jade/20 bg-paper/95 p-3 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 font-sans text-[11px]"><span className="text-jade">{pending?"AI 改动待确认":"本次改动 · 只读"}</span><span className="text-ink-2">{change?.title}</span><span className="text-ink-4">{diff.items.length} 处</span><button type="button" className="ml-auto text-ink-3" aria-label="关闭改动审阅" disabled={busy} onClick={onClose}><X className="size-4"/></button></div>
      <div className="mt-2 flex flex-wrap gap-1.5"><Button size="sm" variant="ghost" icon={<ArrowUp className="size-3"/>} disabled={!diff.items.length} onClick={()=>jump(active-1)}>上一处</Button><Button size="sm" variant="ghost" icon={<ArrowDown className="size-3"/>} disabled={!diff.items.length} onClick={()=>jump(active+1)}>下一处</Button>{pending?<><Button size="sm" variant="ghost" disabled={busy} onClick={()=>setKept(new Set())}>全部还原</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>setKept(new Set(diff.items.map(c=>c.id)))}>全部保留</Button><Button size="sm" variant="primary" className="ml-auto" loading={busy} disabled={!selected.size} icon={<Check className="size-3"/>} onClick={()=>void apply()}>确认应用 · {selected.size} 处</Button></>:null}</div>
      <p className="mt-2 text-[10px] leading-relaxed text-ink-4">{pending?"红色为原文，绿色为候选。确认后写入，未保留的改动恢复原文。":"这里对比的是本次修改前后，不代表当前正文。"}</p>
      {error?<p role="alert" className="mt-2 text-[11px] text-danger">{error}</p>:null}
    </div>
    <div className="font-serif text-[17px] leading-[2.1] text-ink-2">{additions(null)}{blocks.map(b=><React.Fragment key={b.id}>{byId.has(b.id)?renderChange(byId.get(b.id)!):<p className="my-4 whitespace-pre-wrap">{b.text}</p>}{additions(b.id)}</React.Fragment>)}{!diff.items.length?<p>内容没有变化。</p>:null}</div>
  </div>;
}
