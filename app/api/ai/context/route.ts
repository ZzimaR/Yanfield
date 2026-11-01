import type { ContextConfig } from "@/lib/types";
import { ApiError, handle, readJson } from "@/lib/api-utils";
import { assembleContext } from "@/lib/ai/context";
import { mergeContextConfig } from "@/lib/ai/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ContextPreviewBody {
  novelId?: string;
  chapterId?: string | null;
  context?: Partial<ContextConfig>;
  selection?: string;
  mentions?: { type: "character" | "world" | "chapter" | "archive" | "foreshadow"; id: string; label: string }[];
}

/** 上下文装配预览：右侧「上下文抽屉」所见的，就是真正发给模型的内容 */
export const POST = handle(async (req) => {
  const body = await readJson<ContextPreviewBody>(req);
  if (!body.novelId) throw new ApiError("缺少 novelId", 400);
  const assembled = assembleContext({
    novelId: body.novelId,
    chapterId: body.chapterId ?? null,
    config: mergeContextConfig(body.context),
    selection: body.selection,
    mentions: body.mentions,
  });
  return Response.json(assembled);
});
