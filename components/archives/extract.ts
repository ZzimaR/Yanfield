"use client";

/**
 * 档案提取客户端：POST /api/ai/archives/extract 是 SSE 流，
 * 服务端在流末尾直接 upsert 档案（action: save-archive），
 * 这里负责消费流、返回结果，调用方拿到结果后刷新档案列表即可。
 */
import type { AiStreamEvent, StoryArchive } from "@/lib/types";

export interface ArchiveExtractResult {
  ok: boolean;
  archive?: StoryArchive;
  error?: string;
}

export async function extractChapterArchive({
  novelId,
  chapterId,
  signal,
}: {
  novelId: string;
  chapterId: string;
  signal?: AbortSignal;
}): Promise<ArchiveExtractResult> {
  let response: Response;
  try {
    response = await fetch("/api/ai/archives/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ novelId, chapterId }),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return { ok: false, error: "已中止" };
    return { ok: false, error: err instanceof Error ? err.message : "网络错误，提取失败" };
  }

  if (!response.ok) {
    let message = `提取失败（HTTP ${response.status}）`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // 响应不是 JSON 时保留状态码提示
    }
    return { ok: false, error: message };
  }
  if (!response.body) return { ok: false, error: "当前浏览器不支持流式响应" };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let archive: StoryArchive | undefined;
  let streamError: string | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const dataLine = chunk.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        const payload = dataLine.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let event: AiStreamEvent;
        try {
          event = JSON.parse(payload) as AiStreamEvent;
        } catch {
          continue;
        }
        if (event.type === "action" && event.action.type === "save-archive") {
          const actionPayload = event.action.payload as { archive?: StoryArchive } | null;
          if (actionPayload?.archive) archive = actionPayload.archive;
        } else if (event.type === "error") {
          streamError = event.message;
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return { ok: false, error: "已中止" };
    return { ok: false, error: err instanceof Error ? err.message : "读取提取结果时中断" };
  }

  if (streamError) return { ok: false, error: streamError };
  return { ok: true, archive };
}
