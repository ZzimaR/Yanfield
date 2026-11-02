import * as repo from "@/lib/repo";
import { all, get, run as sql, tx } from "@/lib/db";
import { ApiError } from "@/lib/api-utils";
import { countWords, uid } from "@/lib/ui/cn";
import { sameFields, validatePatch } from "./schema";
import { applyBlockDiff, diffBlocks } from "@/lib/diff/blocks";
import type { AgentChange, AgentRun, EntityKind, Fields } from "./types";

export function saveRun(value: AgentRun): void {
  value.updatedAt = new Date().toISOString();
  sql("INSERT INTO agent_runs (id,novel_id,data,created_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data", [value.id,value.novelId,JSON.stringify(value),value.createdAt]);
}
export function getRun(id: string): AgentRun {
  const row = get<{data:string}>("SELECT data FROM agent_runs WHERE id=?",[id]);
  if (!row) throw new ApiError("任务不存在",404);
  return JSON.parse(row.data) as AgentRun;
}
export function listRuns(novelId: string): AgentRun[] {
  return all<{data:string}>("SELECT data FROM agent_runs WHERE novel_id=? ORDER BY created_at DESC LIMIT 30",[novelId]).map(r=>JSON.parse(r.data));
}

/** Outline getters in repo create empty rows. Probe first so agent reads are truly read-only. */
export function readEntity(kind: EntityKind, id: string, novelId: string): Fields | null {
  let result: unknown;
  if (kind === "chapter") result = repo.getChapter(id);
  if (kind === "character") result = repo.getCharacter(id);
  if (kind === "world") result = repo.getWorld(id);
  if (kind === "foreshadow") result = repo.listForeshadows(novelId).find(x=>x.id===id);
  if (kind === "blueprint") {
    if (repo.getChapter(id)?.novelId !== novelId) throw new ApiError("章节不属于该作品",400);
    result = get("SELECT id FROM chapter_blueprints WHERE chapter_id=?",[id]) ? repo.getBlueprint(id) : null;
  }
  if (kind === "outline") {
    if (id !== novelId) throw new ApiError("总纲不属于该作品",400);
    result = get("SELECT id FROM novel_outlines WHERE novel_id=?",[id]) ? repo.getNovelOutline(id) : null;
  }
  if (kind === "volume-outline") {
    if (repo.getVolume(id)?.novelId !== novelId) throw new ApiError("卷不属于该作品",400);
    result = get("SELECT id FROM volume_outlines WHERE volume_id=?",[id]) ? repo.getVolumeOutline(id) : null;
  }
  const row = result ? result as Fields : null;
  if (row && row.novelId !== novelId) throw new ApiError("对象不属于该作品",400);
  return row;
}
export function visibleEntity(kind: EntityKind,id:string,novelId:string): Fields | null {
  const row = readEntity(kind,id,novelId);
  if (row?.aiVisible === false) throw new ApiError("这张资料已对 AI 隐藏",400);
  return row;
}

export function propose(run: AgentRun, kind: EntityKind, targetId: string | null, patch: unknown, reason: string, title?: string): AgentChange {
  const after = validatePatch(kind,patch);
  const existing = run.changes.find(c=>c.kind===kind && c.targetId===targetId && c.state==="pending" && (targetId || c.title === title));
  let before: Fields | null = existing?.before ?? null;
  const dependency = targetId ? run.changes.find(c=>c.id===targetId && c.kind==="chapter" && !c.targetId) : undefined;
  if (targetId && !dependency && !existing) {
    before = visibleEntity(kind,targetId,run.novelId);
    if (!before && !["blueprint","outline","volume-outline"].includes(kind)) throw new ApiError("要修改的对象不存在",404);
  }
  if (dependency && kind!=="blueprint") throw new ApiError("该引用只可用于新章的章纲",400);
  if (!targetId && !["chapter","character","world","foreshadow"].includes(kind)) throw new ApiError("请指定所属章节、卷或作品",400);
  if (!targetId && !after.title && !after.name) throw new ApiError("新建对象需要名称",400);
  const merged = {...existing?.after,...after};
  // Only actual changed fields are displayed and applied. Empty strings are intentional edits.
  for (const key of Object.keys(merged)) if (before && sameFields(before[key],merged[key])) delete merged[key];
  if (!Object.keys(merged).length) throw new ApiError("内容没有变化",400);
  const change: AgentChange = existing ?? {id:uid("change"),kind,targetId,title:title || String(after.title||after.name||before?.title||before?.name||""),reason,before,after:{},state:"pending"};
  change.after=merged; change.reason=reason;
  if (!existing) run.changes.push(change);
  saveRun(run);
  return change;
}

function validateLinks(kind: EntityKind, patch: Fields, novelId: string, targetId: string | null): void {
  if (kind === "chapter" && patch.volumeId && repo.getVolume(String(patch.volumeId))?.novelId!==novelId) throw new ApiError("所属卷无效",400);
  if (kind === "world" && patch.parentId) {
    let parent = String(patch.parentId);
    const seen = new Set<string>(targetId ? [targetId] : []);
    while (parent) {
      if (seen.has(parent)) throw new ApiError("设定父级形成循环",400);
      seen.add(parent);
      const row = repo.getWorld(parent);
      if (!row || row.novelId!==novelId) throw new ApiError("设定父级不属于该作品",400);
      parent=row.parentId||"";
    }
  }
}
function write(kind: EntityKind,id: string | null,novelId: string, patch: Fields): Fields {
  validateLinks(kind,patch,novelId,id);
  switch(kind) {
    case "chapter": {
      const data = {...patch,...(typeof patch.content==="string" ? {wordCount:countWords(patch.content)} : {})};
      const ch = id ? repo.updateChapter(id,data) : repo.updateChapter(repo.createChapter(novelId,data as Partial<import("@/lib/types").Chapter>).id,data);
      if (typeof patch.content==="string") {
        repo.markArchiveStale(ch.id);
        // Global order differs from volume-local orderIndex. Conservative invalidation avoids stale facts.
        sql("UPDATE story_archives SET status='stale' WHERE novel_id=? AND status='fresh'",[novelId]);
      }
      return ch as unknown as Fields;
    }
    case "character": return (id ? repo.updateCharacter(id,patch) : repo.createCharacter(novelId,patch as {name:string})) as unknown as Fields;
    case "world": return (id ? repo.updateWorld(id,patch) : repo.createWorld(novelId,patch as {title:string})) as unknown as Fields;
    case "foreshadow": return (id ? repo.updateForeshadow(id,patch) : repo.createForeshadow(novelId,patch as {title:string})) as unknown as Fields;
    case "blueprint": return repo.saveBlueprint(id!,patch) as unknown as Fields;
    case "outline": return repo.saveNovelOutline(novelId,patch) as unknown as Fields;
    case "volume-outline": return repo.saveVolumeOutline(id!,patch) as unknown as Fields;
  }
}

export function applyChanges(id: string, selections: {id:string; fields?:string[]; blocks?:string[]}[]): AgentRun {
  return tx(()=>{
    const value = getRun(id);
    if (value.status==="running") throw new ApiError("任务还在运行",409);
    const seen = new Set<string>();
    for (const choice of selections) {
      if (seen.has(choice.id)) throw new ApiError("改动重复",400);
      seen.add(choice.id);
      const change = value.changes.find(c=>c.id===choice.id);
      if (!change) throw new ApiError("改动不存在",400);
      if (change.state==="applied") continue; // persistent idempotency
      if (change.state!=="pending") throw new ApiError("这项改动已结束",409);
      const dependency = value.changes.find(c=>c.id===change.targetId);
      const target = dependency ? dependency.appliedId : change.targetId;
      if (dependency && !target) throw new ApiError("请先应用新章，再应用它的章纲",400);
      const current = target ? readEntity(change.kind,target,value.novelId) : null;
      if (!sameFields(current,change.before)) throw new ApiError(`「${change.title}」在生成后已有修改，请核对后重新生成`,409);
      const keys = choice.fields ?? Object.keys(change.after);
      if (!keys.length || keys.some(k=>!Object.hasOwn(change.after,k))) throw new ApiError("所选字段无效",400);
      const patch: Fields = Object.fromEntries(keys.map(k=>[k,change.after[k]]));
      // Content overrides can only be an exact subset of this proposal's block changes.
      if (choice.blocks!==undefined) {
        if(change.kind!=="chapter"||typeof patch.content!=="string") throw new ApiError("只有正文支持逐块审阅",400);
        const before=String(change.before?.content||"");
        const diff=diffBlocks(before,patch.content);
        if(choice.blocks.some(id=>!diff.items.some(item=>item.id===id))) throw new ApiError("正文改动位置无效",400);
        if(!choice.blocks.length) throw new ApiError("请至少保留一处改动",400);
        patch.content=applyBlockDiff(before,diff,choice.blocks);
      }
      validatePatch(change.kind,patch);
      if(!target && ["chapter","character","world","foreshadow"].includes(change.kind) && !patch.title && !patch.name) throw new ApiError("新建对象必须保留名称字段",400);
      if (!target && ["world","character","foreshadow"].includes(change.kind)) {
        const name=String(patch.name||patch.title||"");
        const list = change.kind==="world" ? repo.listWorld(value.novelId) : change.kind==="character" ? repo.listCharacters(value.novelId) : repo.listForeshadows(value.novelId);
        if (list.some(c=>String("name" in c ? c.name : c.title).trim()===name.trim())) throw new ApiError(`「${name}」已存在，请修改已有资料`,409);
      }
      if (!target && change.kind==="chapter") {
        const volumeId=patch.volumeId??null;
        const chapters=repo.listChapters(value.novelId).filter(c=>c.volumeId===volumeId);
        if (chapters.some(c=>c.title===patch.title || c.orderIndex===patch.orderIndex)) throw new ApiError("章节标题或序号已被占用",409);
        patch.orderIndex=patch.orderIndex ?? Math.max(-1,...chapters.map(c=>c.orderIndex))+1;
      }
      const saved=write(change.kind,target||null,value.novelId,patch);
      change.saved=saved; change.appliedId=String(saved.id); change.state="applied";
      // For singleton documents, targetId is the parent identity, not the row identity.
      if (["blueprint","outline","volume-outline"].includes(change.kind)) change.appliedId=target!;
      change.after=patch;
    }
    saveRun(value);
    return value;
  });
}

export function undoChanges(id: string): AgentRun {
  return tx(()=>{
    const value=getRun(id);
    for (const c of [...value.changes].reverse()) {
      if (c.state!=="applied" || !c.appliedId) continue;
      if (!sameFields(readEntity(c.kind,c.appliedId,value.novelId),c.saved)) throw new ApiError(`「${c.title}」已有后续修改，不能覆盖撤回`,409);
      if (c.before) {
        const patch=Object.fromEntries(Object.keys(c.after).map(k=>[k,c.before![k]]));
        write(c.kind,c.appliedId,value.novelId,patch);
      } else {
        if (c.kind==="chapter") {
          if (get("SELECT id FROM chapter_blueprints WHERE chapter_id=?",[c.appliedId]) || repo.getArchiveByChapter(c.appliedId) || get("SELECT id FROM foreshadows WHERE planted_chapter_id=? OR payoff_chapter_id=?",[c.appliedId,c.appliedId]) || get("SELECT id FROM chat_sessions WHERE chapter_id=?",[c.appliedId])) throw new ApiError("新章已有后续关联资料，请先处理关联后再撤回",409);
          repo.deleteChapter(c.appliedId);
        } else if (c.kind==="world") {
          if (repo.listWorld(value.novelId).some(w=>w.parentId===c.appliedId)) throw new ApiError("新设定已有子级，不能撤回",409);
          repo.deleteWorld(c.appliedId);
        } else if (c.kind==="character") {
          if (repo.listCharacters(value.novelId).some(p=>p.relations.some(r=>r.targetId===c.appliedId))) throw new ApiError("角色已有关系，不能撤回",409);
          repo.deleteCharacter(c.appliedId);
        } else if (c.kind==="foreshadow") repo.deleteForeshadow(c.appliedId);
        else if(c.kind==="blueprint") sql("DELETE FROM chapter_blueprints WHERE chapter_id=?",[c.appliedId]);
        else if(c.kind==="outline") sql("DELETE FROM novel_outlines WHERE novel_id=?",[c.appliedId]);
        else sql("DELETE FROM volume_outlines WHERE volume_id=?",[c.appliedId]);
      }
      c.state="reverted";
    }
    saveRun(value); return value;
  });
}
