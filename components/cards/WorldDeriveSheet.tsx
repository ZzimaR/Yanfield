"use client";

import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import { Button, Sheet, Textarea, useToast } from "@/components/ui/kit";
import { streamAiTask, apiPost, notifyDataChanged } from "@/lib/client/api";
import { parseDerivedSettings, type DerivedSetting } from "@/lib/ai/world-derive";
import { WORLD_CATEGORY_LABEL, type WorldCategory, type WorldSetting } from "@/lib/types";
import type { AiStreamEvent } from "@/lib/types";

export interface DeriveSource {
  id: string | null;
  title: string;
  category: WorldCategory;
  summary: string;
  content: string;
}

export function WorldDeriveSheet({
  open,
  novelId,
  source,
  onClose,
  onEnsureSource,
}: {
  open: boolean;
  novelId: string;
  source: DeriveSource;
  onClose: () => void;
  /** 当前卡还没保存时，先落成一条再挂子设定。返回新 id。 */
  onEnsureSource: () => Promise<string | null>;
}) {
  const { toast } = useToast();
  const [note, setNote] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [items, setItems] = React.useState<DerivedSetting[]>([]);
  const [picked, setPicked] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      return;
    }
    setNote("");
    setItems([]);
    setPicked({});
    setError(null);
    setRunning(false);
  }, [open]);

  const generate = () => {
    if (!source.title.trim() && !source.summary.trim() && !source.content.trim()) {
      setError("先写上名称，或贴一段这张卡的内容。");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError(null);
    setItems([]);
    let text = "";
    const material = [
      `当前设定：${source.title || "未命名"}（${WORLD_CATEGORY_LABEL[source.category]}）`,
      source.summary.trim() ? `摘要：\n${source.summary.trim()}` : "",
      source.content.trim() ? `正文：\n${source.content.trim()}` : "",
      note.trim() ? `补充：\n${note.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    void streamAiTask(
      {
        novelId,
        feature: "world-card",
        message: `这是衍生相关设定。\n\n${material}`,
        instruction:
          "这是衍生相关设定，不是补全当前卡片。只输出 JSON：{\"items\":[{\"title\":\"\",\"category\":\"geography\",\"summary\":\"\",\"content\":\"\",\"relation\":\"位于\"}]}。每条是一张可单独保存的新卡，不要把它们写回当前卡，不要提问。",
      },
      {
        signal: controller.signal,
        onEvent: (event: AiStreamEvent) => {
          if (event.type === "delta") text += event.text;
          if (event.type === "error") setError(event.message);
        },
      },
    )
      .then(() => {
        if (controller.signal.aborted) return;
        const next = parseDerivedSettings(text).filter((item) => item.title !== source.title.trim());
        if (next.length === 0) {
          setError("没有拆出可单独保存的条目。可以补一句要衍生哪些，再生成一次。");
          return;
        }
        setItems(next);
        setPicked(Object.fromEntries(next.map((item) => [item.title, true])));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "生成失败");
      })
      .finally(() => {
        if (!controller.signal.aborted) setRunning(false);
      });
  };

  const commit = async () => {
    const chosen = items.filter((item) => picked[item.title]);
    if (chosen.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const sourceId = source.id ?? (await onEnsureSource());
      if (!sourceId) {
        setError("当前卡片还没有名称，先写上再衍生。");
        return;
      }
      for (const item of chosen) {
        await apiPost<WorldSetting>("/api/world", {
          novelId,
          title: item.title,
          category: item.category,
          parentId: item.nest ? sourceId : null,
          summary: item.relation ? `${item.relation}「${source.title || "当前设定"}」。${item.summary}` : item.summary,
          content: item.content,
          tags: [],
          aiVisible: true,
        });
      }
      notifyDataChanged("world");
      toast({ title: `已新增 ${chosen.length} 条相关设定`, description: "当前卡片本身没有被改写。", tone: "success" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "写入失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="衍生相关设定"
      width={560}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          {items.length > 0 ? (
            <Button variant="primary" size="sm" icon={<Check className="size-3.5" />} loading={saving} onClick={() => void commit()}>
              写入选中的
            </Button>
          ) : (
            <Button variant="primary" size="sm" icon={<Sparkles className="size-3.5" />} loading={running} onClick={generate}>
              生成
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-3 p-4">
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          围绕「{source.title || "当前这张卡"}」提出几条可以单独保存的设定。勾选后才会写入。位于、属于这类关系会挂在这张卡下面。
        </p>
        <Textarea
          label="还想衍生什么"
          rows={3}
          value={note}
          placeholder="例如：把州、城和书院拆开。可留空。"
          onChange={(event) => setNote(event.target.value)}
        />
        {error ? <p className="text-[12.5px] text-danger">{error}</p> : null}
        {items.length > 0 ? (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.title} className="rounded-md border border-line px-3 py-2">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={picked[item.title] ?? false}
                    onChange={(event) => setPicked((prev) => ({ ...prev, [item.title]: event.target.checked }))}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink">
                      {item.title}
                      <span className="ml-2 text-[11px] font-normal text-ink-3">
                        {WORLD_CATEGORY_LABEL[item.category]} · {item.relation}
                        {item.nest ? " · 挂到当前卡下" : ""}
                      </span>
                    </span>
                    {item.summary ? <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-2">{item.summary}</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Sheet>
  );
}
