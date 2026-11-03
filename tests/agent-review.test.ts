import { describe, expect, it } from "vitest";
import { applyBlockDiff, diffBlocks } from "@/lib/diff/blocks";
import { reviewUnits, updateAgentReview } from "@/lib/editor/agent-review";
import type { AgentRun } from "@/lib/ai/agent/types";
const run=(state:string,id="run",updatedAt="2")=>({id,updatedAt,changes:[{id:"chapter",state}]} as AgentRun);
describe("Agent review lifecycle",()=>{
  it("returns to editable prose when an open pending review is applied elsewhere",()=>{
    expect(updateAgentReview({run:run("pending"),changeId:"chapter"},run("applied"))).toBeNull();
  });
  it("closes discarded reviews without affecting explicit history",()=>{
    expect(updateAgentReview({run:run("pending"),changeId:"chapter"},run("rejected"))).toBeNull();
    expect(updateAgentReview({run:run("applied"),changeId:"chapter"},run("reverted"))?.run.changes[0].state).toBe("reverted");
  });
  it("ignores unrelated updates and stale responses",()=>{
    const current={run:run("pending"),changeId:"chapter"};
    expect(updateAgentReview(current,run("applied","other"))).toBe(current);
    expect(updateAgentReview(current,run("applied","run","1"))).toBe(current);
    expect(updateAgentReview(null,run("applied"))).toBeNull();
  });
});

describe("Review units preserve the commit protocol",()=>{
  it("groups a new chapter into one green review and preserves every paragraph on acceptance",()=>{
    const after=Array.from({length:85},(_,index)=>`<p>第${index+1}段：新建正文。</p>`).join("");
    const units=reviewUnits("",after);
    expect(units).toHaveLength(1);
    expect(units[0].afterText?.split("\n\n")).toHaveLength(85);
    expect(applyBlockDiff("",diffBlocks("",after),units[0].ids)).toBe(after);
  });
  it("retains individual existing-text changes for mixed keep/restore decisions",()=>{
    const before="<p>第一段原文。</p><p>中间不变。</p><p>第三段原文。</p>";
    const after="<p>第一段改写。</p><p>中间不变。</p><p>第三段改写。</p>";
    const units=reviewUnits(before,after);
    expect(units).toHaveLength(2);
    expect(applyBlockDiff(before,diffBlocks(before,after),units[0].ids)).toBe("<p>第一段改写。</p><p>中间不变。</p><p>第三段原文。</p>");
  });
});
