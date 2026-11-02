"use client";
import { apiPost, notifyDataChanged } from "@/lib/client/api";
import type { EditorBridge } from "@/lib/editor/bridge";
import type { Chapter } from "@/lib/types";
import type { AgentRun } from "./types";

export const AGENT_UPDATED="yantian:agent-updated";
export function broadcastRun(run:AgentRun):void {window.dispatchEvent(new CustomEvent(AGENT_UPDATED,{detail:run}));}
export function openAgentReview(run:AgentRun,changeId:string):void {
  window.dispatchEvent(new CustomEvent("yantian:agent-review",{detail:{run,changeId}}));
}
export async function commitAgent(runId:string,body:unknown,bridge:EditorBridge|null):Promise<AgentRun> {
  // Stop editor input before flushing so no keystroke can be overwritten by a concurrent commit.
  bridge?.setReadOnly?.(true);
  try {
    await bridge?.flush?.();
    const run=await apiPost<AgentRun>(`/api/ai/agent/${runId}/apply`,body);
    const current=bridge?.getChapterId?.();
    const changed=run.changes.find(c=>c.kind==="chapter"&&c.appliedId===current);
    if(changed && !(changed.state==="reverted"&&!changed.before)) {
      // Undo returns the old snapshot; fetch it because IDs/wordCount remain server-owned.
      const {apiGet}=await import("@/lib/client/api");
      const chapter=await apiGet<Chapter>(`/api/chapters/${current}`);
      bridge?.syncSaved?.(chapter);
    }
    broadcastRun(run);notifyDataChanged("agent");return run;
  } finally {bridge?.setReadOnly?.(false);}
}
