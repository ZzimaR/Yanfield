import { CODEX_CONTEXT_LIMIT, type CodexItem, type CodexTurn } from "@/lib/ai/codex";
import { runCodexStream } from "@/lib/ai/engine";
import { ApiError, handle, readJson } from "@/lib/api-utils";
import { linkedSignal, sseResponse } from "../sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CodexBody {
  novelId?: string;
  message?: string;
  history?: CodexTurn[];
  draft?: CodexItem[];
  /** 当前章节正文节选；字符串，服务端再兜底截断到 CODEX_CONTEXT_LIMIT。 */
  contextText?: unknown;
}

/** 资料助手：根据作者粘贴的文字或对话，提案要新建/修改的角色、世界观与伏笔卡。 */
export const POST = handle(async (req) => {
  const body = await readJson<CodexBody>(req);
  if (!body.novelId) throw new ApiError("缺少 novelId", 400);
  if (!body.message?.trim()) throw new ApiError("消息不能为空", 400);
  if (body.contextText != null && typeof body.contextText !== "string") {
    throw new ApiError("contextText 必须是字符串", 400);
  }
  const contextText =
    typeof body.contextText === "string" ? body.contextText.trim().slice(0, CODEX_CONTEXT_LIMIT) : "";
  return sseResponse((signal) =>
    runCodexStream({
      novelId: body.novelId as string,
      message: body.message as string,
      history: Array.isArray(body.history) ? body.history : [],
      draft: Array.isArray(body.draft) ? body.draft : [],
      contextText: contextText || undefined,
      signal: linkedSignal(req, signal),
    }),
  );
});
