import { handle, notFound, ok } from "@/lib/api-utils";
import * as repo from "@/lib/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle<{ id: string }>(async (_request, { params }) => {
  const tree = repo.getNovelTree(params.id);
  if (!tree) return notFound("作品不存在");
  return ok(tree);
});
