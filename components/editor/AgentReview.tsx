"use client";
import * as React from "react";
import { ArrowDown, ArrowUp, Check, X } from "lucide-react";
import { Button } from "@/components/ui/kit";
import { splitBlocks } from "@/lib/diff/blocks";
import { reviewUnits } from "@/lib/editor/agent-review";
import { useEditorBridge } from "@/lib/editor/bridge";
import { apiGet, apiPatch, notifyDataChanged } from "@/lib/client/api";
import { broadcastRun, commitAgent } from "@/lib/ai/agent/client";
import type { AgentRun } from "@/lib/ai/agent/types";

export function AgentReview({initial,changeId,onClose}:{initial:AgentRun;changeId:string;onClose:()=>void}) {
  const [run,setRun]=React.useState(initial);
  const [choices,setChoices]=React.useState<Record<string,boolean>>({});
  const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(""),[active,setActive]=React.useState(0);
  const busyRef=React.useRef(false);
  const bridge=useEditorBridge(),root=React.useRef<HTMLDivElement>(null);
  React.useEffect(()=>{
    let live=true;
    void apiGet<AgentRun>(`/api/ai/agent/${initial.id}`).then(value=>{if(live)setRun(current=>value.updatedAt>=current.updatedAt?value:current);}).catch(e=>{if(live)setError(e.message);});
    return()=>{live=false;};
  },[initial.id]);
  const change=run.changes.find(c=>c.id===changeId);
  const before=String(change?.before?.content||""),after=String(change?.after.content||"");
  const units=React.useMemo(()=>reviewUnits(before,after),[before,after]);
  const pending=change?.state==="pending";
  const jump=(index:number)=>{
    if(!units.length)return;
    const next=(index+units.length)%units.length;setActive(next);
    root.current?.querySelector(`[data-change-index="${next}"]`)?.scrollIntoView({behavior:"smooth",block:"center"});
  };
  const finish=async(decisions:Record<string,boolean>)=>{
    if(!change||busyRef.current||!pending)return;
    busyRef.current=true;setBusy(true);setError("");
    const blocks=units.filter(unit=>decisions[unit.id]!==false).flatMap(unit=>unit.ids);
    try {
      if(blocks.length){
        const result=await commitAgent(run.id,{selections:[{id:change.id,blocks}]},bridge);
        const saved=result.changes.find(c=>c.id===change.id);
        const id=saved?.appliedId||saved?.targetId;
        if(id)window.dispatchEvent(new CustomEvent("yantian:agent-navigate",{detail:{kind:"chapter",id}}));
      }else{
        const result=await apiPatch<AgentRun>(`/api/ai/agent/${run.id}`,{op:"reject",changeId:change.id});
        broadcastRun(result);notifyDataChanged("agent");
      }
      onClose();
    }catch(e){setError(e instanceof Error?e.message:"应用失败");}
    finally{busyRef.current=false;setBusy(false);}
  };
  const choose=(id:string,keep:boolean)=>{
    const next={...choices,[id]:keep};setChoices(next);
    if(units.every(unit=>next[unit.id]!==undefined))void finish(next);
  };
  const renderChange=(item:(typeof units)[number])=>{
    const index=units.indexOf(item),decision=choices[item.id];
    if(pending && decision!==undefined)return <section key={item.id} data-change-index={index} className="my-5">
      <button type="button" disabled={busy} className="mb-1 font-sans text-[10px] text-ink-4" onClick={()=>setChoices(current=>{const next={...current};delete next[item.id];return next;})}>{decision?"已保留":"已还原"} · 重新审阅</button>
      <p className="whitespace-pre-wrap">{decision?item.afterText:item.beforeText}</p>
    </section>;
    return <section key={item.id} data-change-index={index} className="my-6">
      <div className={`mb-2 border-l-2 px-3 py-2 ${item.beforeText?"border-danger/40 bg-danger/[0.045]":"border-jade/40 bg-jade/[0.035]"}`}>
        <div className="mb-2 flex flex-wrap items-center gap-2 font-sans text-[10px] text-ink-3">
          <span>AI 修改 · 第 {index+1}/{units.length} 处</span>
          {pending?<div className="ml-auto flex gap-1">
            <button type="button" disabled={busy} className="inline-flex items-center gap-1 rounded border border-jade/25 px-2 py-1 text-jade hover:bg-jade/10" onClick={()=>choose(item.id,true)}><Check className="size-3"/>保留</button>
            <button type="button" disabled={busy} className="rounded border border-line px-2 py-1 text-ink-3 hover:bg-surface-2" onClick={()=>choose(item.id,false)}>还原</button>
          </div>:<span className="ml-auto text-ink-4">历史快照</span>}
        </div>
        {item.beforeText?<p className="whitespace-pre-wrap text-ink-3">{item.inline?item.inline.filter(s=>s.type!=="add").map((s,i)=><span key={i} className={s.type==="del"?"bg-danger/15 text-danger line-through":""}>{s.text}</span>):<del className="bg-danger/10 text-danger">{item.beforeText}</del>}</p>:null}
        {!item.beforeText && item.afterText?<p className="whitespace-pre-wrap"><span className="bg-jade/15 text-jade">{item.afterText}</span></p>:null}
      </div>
      {item.beforeText && item.afterText?<p className="whitespace-pre-wrap">{item.inline?item.inline.filter(s=>s.type!=="del").map((s,i)=><span key={i} className={s.type==="add"?"bg-jade/15 text-jade":""}>{s.text}</span>):<span className="bg-jade/15 text-jade">{item.afterText}</span>}</p>:null}
    </section>;
  };
  const blocks=splitBlocks(before),byId=new Map(units.filter(c=>c.type!=="added").map(c=>[c.id,c]));
  const additions=(anchor:string|null)=>units.filter(c=>c.type==="added"&&c.anchorId===anchor).map(renderChange);
  return <div ref={root} data-testid="agent-inline-review" className="ai-surface pb-8">
    <div className="sticky top-0 z-20 -mx-2 mb-6 border-y border-line bg-paper/95 px-2 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 font-sans text-[11px]">
        <span className="text-jade">{pending?"AI 修改待审阅":"历史改动 · 只读"}</span><span className="text-ink-2">{change?.title}</span><span className="text-ink-4">{units.length} 处</span>
        <button type="button" className="ml-auto inline-flex items-center gap-1 text-ink-3" aria-label="返回正文编辑" disabled={busy} onClick={onClose}><X className="size-3"/>返回正文</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {units.length>1?<><Button size="sm" variant="ghost" icon={<ArrowUp className="size-3"/>} onClick={()=>jump(active-1)}>上一处</Button><Button size="sm" variant="ghost" icon={<ArrowDown className="size-3"/>} onClick={()=>jump(active+1)}>下一处</Button></>:null}
        {pending?<><Button size="sm" variant="ghost" disabled={busy} onClick={()=>void finish(Object.fromEntries(units.map(unit=>[unit.id,false])))}>全部还原</Button><Button size="sm" variant="primary" className="ml-auto" loading={busy} disabled={!units.length} icon={<Check className="size-3"/>} onClick={()=>void finish(choices)}>{Object.keys(choices).length?"确认剩余改动":"全部保留"}</Button></>:null}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-ink-4">{pending?"红色为删除，绿色为新增。逐处保留或还原；审阅完成后自动回到正文，也可一次全部保留。":"这里保留本次修改前后的记录。关闭后即可继续编辑当前正文。"}</p>
      {error?<p role="alert" className="mt-2 text-[11px] text-danger">{error}</p>:null}
    </div>
    <div className="font-serif text-[17px] leading-[2.1] text-ink-2">{additions(null)}{blocks.map(b=><React.Fragment key={b.id}>{byId.has(b.id)?renderChange(byId.get(b.id)!):<p className="my-5 whitespace-pre-wrap">{b.text}</p>}{additions(b.id)}</React.Fragment>)}{!units.length?<p>内容没有变化。</p>:null}</div>
  </div>;
}
