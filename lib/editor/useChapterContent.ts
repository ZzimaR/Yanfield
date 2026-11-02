"use client";

import * as React from "react";
import { apiGet } from "@/lib/client/api";
import type { Chapter } from "@/lib/types";

/** One body at a time; request identity also guards rapid A → B → A switches. */
export function useChapterContent(chapterId: string | null) {
  const [revision, retry] = React.useReducer((n: number) => n + 1, 0);
  const request = React.useMemo(() => ({ chapterId, revision }), [chapterId, revision]);
  const [result, setResult] = React.useState<{ request: typeof request; data?: Chapter; error?: string } | null>(null);
  React.useEffect(() => {
    if (!request.chapterId) return;
    const controller = new AbortController();
    void apiGet<Chapter>(`/api/chapters/${request.chapterId}`, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setResult({ request, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ request, error: error instanceof Error ? error.message : "正文加载失败" });
    });
    return () => controller.abort();
  }, [request]);
  const current = result?.request === request ? result : null;
  return { data: current?.data, error: current?.error, refresh: retry };
}
