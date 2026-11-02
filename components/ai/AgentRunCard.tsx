"use client";
import * as React from "react";
import { BookOpen, FolderOpen, Layers3, Check, ChevronDown, CircleAlert, FilePenLine, Loader2, RotateCcw } from "lucide-react";
import { MaterialPreview } from "@/components/cards/MaterialPreview";
import { Button, useToast } from "@/components/ui/kit";
import { apiGet, apiPatch, useDataChanged } from "@/lib/client/api";
import { useEditorBridge } from "@/lib/editor/bridge";
import { countWords, stripHtml } from "@/lib/ui/cn";
import { diffInline } from "@/lib/diff/blocks";
import { AGENT_UPDATED,broadcastRun,commitAgent,openAgentReview } from "@/lib/ai/agent/client";
import { ENTITY_LABEL, FIELD_LABEL, type AgentChange, type AgentRun } from "@/lib/ai/agent/types";

function display(value:unknown):string {
  if(value===null||value===undefined||value==="") return "未填写";
  if(Array.isArray(value)) return value.map(v=>typeof v==="string"?v:JSON.stringify(v)).join("\n");
  return typeof value==="object"?JSON.stringify(value,null,2):String(value);
}
function evidenceLabel(run:AgentRun,e:NonNullable<AgentChange["evidence"]>[number]):string {
  if(!e.candidate)return "已有正文";
  const source=run.changes.find(c=>c.id===e.sourceId);
  if(source?.state==="reverted")return "已撤回正文";
  if(source?.state==="rejected")return "已丢弃正文";
  if(source?.state==="applied")return stripHtml(String(source.after.content||"")).includes(e.quote)?"本轮正文":"未采用的候选正文";
  return "待确认正文";
}
export function FieldChange({before,after}:{before:unknown;after:unknown}) {
  const segments=diffInline(display(before),display(after));
  return <div className="space-y-1.5 text-[12px] leading-[1.85]">
    <div className="whitespace-pre-wrap rounded-md border-l-2 border-danger/25 bg-danger/[0.035] px-2.5 py-2 text-ink-3"><span className="mr-2 text-[10px] text-danger">原</span>{segments.filter(x=>x.type!=="add").map((s,i)=><span key={i} className={s.type==="del"?"bg-danger/10 text-danger line-through":""}>{s.text}</span>)}</div>
    <div className="whitespace-pre-wrap rounded-md border-l-2 border-jade/35 bg-jade/[0.035] px-2.5 py-2 text-ink-2"><span className="mr-2 text-[10px] text-jade">改</span>{segments.filter(x=>x.type!=="del").map((s,i)=><span key={i} className={s.type==="add"?"bg-jade/15 text-jade":""}>{s.text}</span>)}</div>
  </div>;
}
export function AgentRunCard({runId,initial,disabled=false,onContinue}:{runId:string;initial?:AgentRun;disabled?:boolean;onContinue?:(text:string)=>void}) {
  const [run,setRun]=React.useState<AgentRun|undefined>(initial);
  const [error,setError]=React.useState("");
  const [expanded,setExpanded]=React.useState<string|null>(null);
  const [materialsOpen,setMaterialsOpen]=React.useState(false);
  const [focusedMaterial,setFocusedMaterial]=React.useState<string|null>(null);
  const materialNodes=React.useRef<Record<string,HTMLDivElement|null>>({});
  React.useEffect(()=>{if(materialsOpen&&focusedMaterial)materialNodes.current[focusedMaterial]?.scrollIntoView({block:"nearest",behavior:"smooth"});},[materialsOpen,focusedMaterial]);
  const [picked,setPicked]=React.useState<Record<string,boolean>>({});
  const [fields,setFields]=React.useState<Record<string,string[]>>({});
  const [busy,setBusy]=React.useState(false);
  const bridge=useEditorBridge(),{toast}=useToast();
  const receive=React.useCallback((value:AgentRun)=>setRun(current=>!current||current.id!==value.id||value.updatedAt>=current.updatedAt?{...value}:current),[]);
  const refresh=React.useCallback(()=>{void apiGet<AgentRun>(`/api/ai/agent/${runId}`).then(receive).catch(e=>setError(e.message));},[runId,receive]);
  React.useEffect(()=>{if(initial)receive(initial);else refresh();},[initial,refresh,receive]);
  React.useEffect(()=>{
    const listen=(event:Event)=>{const value=(event as CustomEvent<AgentRun>).detail;if(value.id===runId)receive(value);};
    window.addEventListener(AGENT_UPDATED,listen);return()=>window.removeEventListener(AGENT_UPDATED,listen);
  },[runId,receive]);
  useDataChanged(refresh,["agent"]);
  React.useEffect(()=>{if(run?.status!=="running"||disabled)return;const timer=window.setInterval(refresh,1500);return()=>window.clearInterval(timer);},[run?.status,disabled,refresh]);
  const mutate=async(action:()=>Promise<AgentRun>)=>{
    if(busy)return;setBusy(true);setError("");
    try{const result=await action();setRun(result);broadcastRun(result);}
    catch(e){const text=e instanceof Error?e.message:"操作失败";setError(text);toast({title:"改动未应用",description:text,tone:"error"});}
    finally{setBusy(false);}
  };
  if(!run)return <div className="mt-3 text-[12px] text-ink-3">{error||"正在读取任务…"}{error?<Button size="sm" onClick={refresh}>重试</Button>:null}</div>;
  const pending=run.changes.filter(c=>c.state==="pending");
  const applied=run.changes.filter(c=>c.state==="applied");
  const running=run.status==="running";
  const live=run.changes.filter(c=>c.state!=="rejected"&&c.state!=="reverted");
  const materials=live.filter(c=>c.kind!=="chapter");
  const chapterCount=live.filter(c=>c.kind==="chapter").length;
  const apply=(changes:AgentChange[])=>mutate(()=>commitAgent(run.id,{selections:changes.map(c=>({id:c.id,fields:fields[c.id]}))},bridge));
  const selected=pending.filter(c=>picked[c.id]!==false);
  return <div className="my-4 min-w-0 overflow-hidden rounded-lg border border-line/80 bg-surface" data-testid="agent-run-card">
    <div className="flex items-center gap-2 border-b border-line/70 px-4 py-3.5 text-[12px]">
      {running?<Loader2 className="size-3.5 animate-spin text-accent"/>:applied.length?<Check className="size-3.5 text-jade"/>:<FilePenLine className="size-3.5 text-accent"/>}
      <span className="font-medium text-ink">{running?"助手正在处理":pending.length?"待确认改动":applied.length?"已应用":"任务记录"}</span>
      <span className="ml-auto text-[10px] text-ink-4">{[chapterCount?`正文 · ${chapterCount}`:"",materials.length?`资料 · ${materials.length}`:""].filter(Boolean).join("　")}</span>
    </div>
    <div className="px-4 py-2.5">
      <details open={running||undefined} className="text-[11px] text-ink-3">
        <summary className="cursor-pointer py-1">执行过程 · {run.steps.length} 步</summary>
        <ol className="my-2 space-y-2 border-l border-line pl-3">{run.steps.map(s=><li key={s.id}><div className={s.status==="error"?"text-danger":"text-ink-2"}>{s.status==="running"?"◌":s.status==="error"?"!":"✓"} {s.label}</div><p className="mt-0.5 leading-relaxed text-ink-4">{s.detail}</p></li>)}</ol>
      </details>
      {run.references.length?<details className="text-[11px] text-ink-3"><summary className="cursor-pointer py-1">参考资料 · {run.references.length}</summary><div className="my-2 flex flex-wrap gap-1">{run.references.map(r=><button type="button" key={r.kind+r.id} className="rounded bg-surface-2 px-2 py-1 hover:text-accent" onClick={()=>{
        if(["world","character","foreshadow"].includes(r.kind))window.dispatchEvent(new CustomEvent("yantian:open-card",{detail:{kind:r.kind,id:r.id}}));
        else window.dispatchEvent(new CustomEvent("yantian:agent-navigate",{detail:{kind:r.kind,id:r.id}}));
      }}>{ENTITY_LABEL[r.kind]} · {r.title}</button>)}</div></details>:null}
    </div>
    {materials.length?<div className="border-t border-line/60 bg-paper/25 px-4 py-3.5">
      <button type="button" className="mb-2.5 flex w-full items-center gap-2 text-left text-[11px] text-ink-3" aria-expanded={materialsOpen} onClick={()=>setMaterialsOpen(!materialsOpen)}><Layers3 className="size-3.5 text-jade"/><span>{materials.some(c=>c.state==="pending")?"资料待确认":"资料改动"} · {materials.length} 项</span><ChevronDown className={`ml-auto size-3 transition-transform ${materialsOpen?"rotate-180":""}`}/></button>
      <div className="flex flex-wrap gap-1.5">{materials.map(c=><button key={c.id} type="button" onClick={()=>{setMaterialsOpen(true);setFocusedMaterial(c.id);setExpanded(null);}} className={`max-w-full truncate rounded-lg border px-2 py-1.5 text-[11px] transition-colors hover:border-jade/40 ${c.kind==="character"?"border-[#9a83a0]/15 bg-[#9a83a0]/10 text-[#88718f] dark:text-[#baa7c1]":"border-jade/15 bg-jade/[0.065] text-jade"}`}><span className="mr-1.5 opacity-70">{ENTITY_LABEL[c.kind]}</span>{c.title}</button>)}</div>
      <p className="mt-2 text-[10px] leading-relaxed text-ink-4">新建 {materials.filter(c=>!c.before).length} · 更新 {materials.filter(c=>c.before).length}　{materials.some(c=>c.state==="pending")?"点击资料查看内容与依据，确认后加入资料库。":"已应用的资料可打开继续编辑。"}</p>
    </div>:null}
    {run.preview?<div className="max-h-48 overflow-y-auto border-t border-line/60 px-4 py-4"><p className="mb-2 text-[10px] text-jade">写手正在起草</p><p className="whitespace-pre-wrap font-serif text-[13px] leading-loose text-ink-2">{run.preview}</p></div>:null}
    {run.changes.filter(c=>c.kind==="chapter"||materialsOpen).map(c=>{
      const isPending=c.state==="pending",isChapter=c.kind==="chapter";
      const keys=Object.keys(c.after),chosen=fields[c.id]??keys;
      return <div key={c.id} ref={node=>{materialNodes.current[c.id]=node;}} className="scroll-mt-4 border-t border-line/70 px-4 py-4">
        <div className="flex items-center gap-2">
          {isPending?<input aria-label={`选择${c.title}`} type="checkbox" checked={picked[c.id]!==false} disabled={busy||running||disabled} onChange={e=>setPicked(p=>({...p,[c.id]:e.target.checked}))}/>:<Check className="size-3 text-jade"/>}
          <button type="button" className="min-w-0 flex-1 truncate text-left font-serif text-[16px] tracking-[0.035em] text-ink" onClick={()=>setExpanded(expanded===c.id?null:c.id)}>{c.title||ENTITY_LABEL[c.kind]}</button>
          <span className="shrink-0 text-[10px] text-ink-3">{ENTITY_LABEL[c.kind]} · {c.state==="applied"?"已应用":c.state==="reverted"?"已撤回":c.state==="rejected"?"已丢弃":c.before?"修改":"新建"}</span>
        </div>
        {isChapter?<>
          <div className="my-2 flex items-center justify-between text-[10px] text-ink-4"><span>{run.model}</span><span>{countWords(String(c.after.content||""))} 字</span></div>
          <p className={`whitespace-pre-wrap font-serif text-[14px] leading-[2] text-ink-2 ${expanded===c.id?"":"line-clamp-5"}`}>{stripHtml(String(c.after.content||""))}</p>
          <button type="button" className="my-2 flex w-full items-center justify-center gap-1 text-[11px] text-ink-3" onClick={()=>setExpanded(expanded===c.id?null:c.id)}><ChevronDown className="size-3"/>{expanded===c.id?"收起":"展开全文"}</button>
          <Button className="w-full justify-center border-accent/20 bg-accent/5 py-2 text-accent hover:bg-accent/10" size="sm" variant="secondary" icon={<BookOpen className="size-3"/>} disabled={running||busy||disabled} onClick={()=>openAgentReview(run,c.id)}>{isPending?"在正文中审阅改动":"查看本次改动"}</Button>
        </>:<>
          {["character","world","foreshadow"].includes(c.kind)?<div className="mt-3 rounded-xl border border-line/65 bg-paper/25 p-3"><MaterialPreview kind={c.kind as "character"|"world"|"foreshadow"} fields={{...c.before,...c.after}} showTitle={false}/></div>:null}
          <p className="mt-2 text-[11px] leading-relaxed text-ink-4">{c.reason}</p>
          {c.evidence?.length?<details className="mt-2 text-[11px] text-ink-3"><summary className="cursor-pointer">原文依据 · {c.evidence.length}</summary><div className="mt-2 space-y-2">{c.evidence.map((e,i)=><blockquote key={i} className="border-l-2 border-jade/25 pl-2.5 leading-relaxed"><span className="mb-1 block text-[10px] text-jade">{e.title}{` · ${evidenceLabel(run,e)}`}</span>{e.quote}</blockquote>)}</div></details>:null}
          {(c.appliedId||c.targetId)&&["character","world","foreshadow"].includes(c.kind)?<button type="button" className="mr-4 mt-2 inline-flex items-center gap-1 text-[11px] text-accent" onClick={()=>window.dispatchEvent(new CustomEvent("yantian:open-card",{detail:{kind:c.kind,id:c.appliedId||c.targetId}}))}><FolderOpen className="size-3"/>{isPending?"打开原资料":"打开资料"}</button>:null}
          <button type="button" className="mt-2 text-[11px] text-accent" onClick={()=>setExpanded(expanded===c.id?null:c.id)}>{expanded===c.id?"收起改动":"查看改动"} · {keys.length}</button>
          {expanded===c.id?<div className="mt-3 space-y-3">{keys.map(key=><div key={key}>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] text-ink-3">{isPending?<input type="checkbox" checked={chosen.includes(key)} disabled={busy||running||disabled} onChange={e=>setFields(p=>({...p,[c.id]:e.target.checked?[...chosen,key]:chosen.filter(k=>k!==key)}))}/>:null}{FIELD_LABEL[key]||key}</label>
            {c.before?<FieldChange before={c.before[key]} after={c.after[key]}/>:<p className="whitespace-pre-wrap rounded-lg border-l-2 border-jade/25 bg-jade/[0.035] px-3 py-2 text-[12px] leading-[1.85] text-ink-2">{display(c.after[key])}</p>}</div>)}</div>:null}
        </>}
        {isPending?<div className="mt-2 flex items-center gap-2"><button type="button" className="text-[10px] text-ink-4 hover:text-danger" disabled={running||busy||disabled} onClick={()=>void mutate(()=>apiPatch<AgentRun>(`/api/ai/agent/${run.id}`,{op:"reject",changeId:c.id}))}>丢弃此项</button>{!isChapter?<Button className="ml-auto" size="sm" disabled={running||busy||disabled||!chosen.length} onClick={()=>void apply([c])}>应用此项</Button>:null}</div>:null}
      </div>;
    })}
    {error||run.error?<p role="alert" className="mx-3 mb-3 rounded bg-danger/5 p-2 text-[11px] leading-relaxed text-danger"><CircleAlert className="mr-1 inline size-3"/>{error||run.error}</p>:null}
    {!running?<div className="flex flex-wrap items-center gap-2 border-t border-line/70 bg-paper/35 px-4 py-3">
      {pending.length?<Button variant="primary" size="sm" className="min-h-9 flex-1 justify-center shadow-none" loading={busy} disabled={disabled||!selected.length||selected.some(c=>fields[c.id]?.length===0)} onClick={()=>void apply(selected)}>应用选中的 {selected.length} 项</Button>:null}
      {applied.length?<Button size="sm" variant="ghost" disabled={disabled||busy} icon={<RotateCcw className="size-3"/>} onClick={()=>void mutate(()=>commitAgent(run.id,{op:"undo"},bridge))}>撤回本轮</Button>:null}
      {onContinue?<button type="button" className="text-[11px] text-ink-3 hover:text-accent" disabled={busy||disabled} onClick={()=>onContinue("请基于上轮候选继续修改：")}>继续修改</button>:null}
    </div>:null}
  </div>;
}
