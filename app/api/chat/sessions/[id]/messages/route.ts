import { bad, handle, notFound, ok } from "@/lib/api-utils";
import * as repo from "@/lib/repo";
import type { ChatMessage } from "@/lib/types";
import { isObject, pickEnum, pickFields, readBody, type FieldSpec } from "@/app/api/_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESSAGE_FIELDS: FieldSpec = {
  content: "str",
  actions: "json",
  status: "str",
  provider: "str",
  model: "str",
  usage: "json",
  error: "str",
};

const MESSAGE_STATUSES = ["complete", "streaming", "error", "aborted"] as const;

export const GET = handle<{ id: string }>(async (_request, { params }) => {
  if (!repo.getChatSession(params.id)) return notFound("会话不存在");
  return ok({ items: repo.listMessages(params.id) });
});

export const POST = handle<{ id: string }>(async (request, { params }) => {
  if (!repo.getChatSession(params.id)) return notFound("会话不存在");

  const body = await readBody(request);
  const role = pickEnum(body, "role", ["user", "assistant"] as const, "消息角色");
  if (!role) return bad("role 必须是 user 或 assistant");

  const input = pickFields<ChatMessage>(body, MESSAGE_FIELDS);
  const status = pickEnum(body, "status", MESSAGE_STATUSES, "消息状态");
  if (status) input.status = status;
  if (input.actions !== undefined && !Array.isArray(input.actions)) {
    return bad("actions 必须是数组");
  }
  if (input.usage !== undefined && input.usage !== null && !isObject(input.usage)) {
    return bad("usage 必须是对象或 null");
  }

  return ok(repo.addMessage(params.id, { ...input, role }), { status: 201 });
});
