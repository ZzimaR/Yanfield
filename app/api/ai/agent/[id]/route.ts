import { handle, ok } from "@/lib/api-utils";
import { getRun, saveRun } from "@/lib/ai/agent/store";
import { readBody } from "@/app/api/_lib/http";
import { ApiError } from "@/lib/api-utils";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const GET=handle<{id:string}>(async(_request,{params})=>ok(getRun(params.id)));
export const PATCH=handle<{id:string}>(async(request,{params})=>{
  const body=await readBody(request),value=getRun(params.id);
  if(value.status==="running") throw new ApiError("任务仍在运行",409);
  if(body.op!=="reject") throw new ApiError("不支持的操作",400);
  const change=value.changes.find(c=>c.id===body.changeId);
  if(!change||change.state!=="pending") throw new ApiError("待确认改动不存在",409);
  change.state="rejected";saveRun(value);return ok(value);
});
