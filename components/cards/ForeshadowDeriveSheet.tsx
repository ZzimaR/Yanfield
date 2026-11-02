"use client";

import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import { Button, Sheet, Textarea, useToast } from "@/components/ui/kit";
import { streamAiTask, apiPost, notifyDataChanged } from "@/lib/client/api";
import { parseDerivedForeshadows, type DerivedForeshadow } from "@/lib/ai/card-derive";
import { FORESHADOW_STATUS_LABEL, type AiStreamEvent, type Foreshadow } from "@/lib/types";

export interface ForeshadowDeriveSource {
  id: string | null;
  title: string;
  description: string;
  notes: string;
}

export function ForeshadowDeriveSheet({
  open,
  novelId,
  source,
  onClose,
  onEnsureSource,
}: {
  open: boolean;
  novelId: string;
  source: ForeshadowDeriveSource;
  onClose: () => void;
  onEnsureSource: () => Promise<string | null>;
}) {
  const { toast } = useToast();
  const [note, setNote] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [items, setItems] = React.useState<DerivedForeshadow[]>([]);
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
    if (!source.title.trim() && !source.description.trim() && !source.notes.trim()) {
      setError("先写上标题，或贴一段这条伏笔。");
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
      `当前伏笔：${source.title || "未命名"}`,
      source.description.trim() ? `说明：\n${source.description.trim()}` : "",
      source.notes.trim() ? `备注：\n${source.notes.trim()}` : "",
      note.trim() ? `补充：\n${note.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    void streamAiTask(
      {
        novelId,
        feature: "foreshadow-card",
        message: `这是衍生相关伏笔。\n\n${material}`,
        instruction:
          "这是衍生相关伏笔，不是补全当前卡片。只输出 JSON：{\"items\":[{\"title\":\"\",\"description\":\"\",\"status\":\"planted\",\"notes\":\"\"}]}。每条是一条可单独登记的新伏笔，不要改当前这一条，不要提问。",
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
        const next = parseDerivedForeshadows(text).filter((item) => item.title !== source.title.trim());
        if (next.length === 0) {
          setError("没有拆出可单独登记的伏笔。可以补一句要拆什么，再生成一次。");
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
        setError("当前伏笔还没有标题，先写上再衍生。");
        return;
      }
      for (const item of chosen) {
        await apiPost<Foreshadow>("/api/foreshadows", {
          novelId,
          title: item.title,
          description: item.description,
          status: item.status,
          notes: item.notes,
        });
      }
      notifyDataChanged("foreshadows");
      toast({ title: `已新增 ${chosen.length} 条相关伏笔`, description: "当前这张卡本身没有被改写。", tone: "success" });
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
      title="衍生相关伏笔"
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
        <ol className="space-y-1.5 text-[12.5px] leading-6 text-ink-2">
          <li>1. 先确认当前卡是「{source.title || "还没写标题"}」。没写标题就先回去填。</li>
          <li>2. 点「生成」。想指定拆出哪几条，写在下面；留空就按这张卡已有的内容来。</li>
          <li>3. 勾上要留下的。取消勾选的不会保存。写入后，当前这条伏笔不会被改写。</li>
        </ol>
        <Textarea
          label="还想衍生什么"
          rows={3}
          value={note}
          placeholder="例如：把回收和误导拆成两条。可留空。"
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
                      <span className="ml-2 text-[11px] font-normal text-ink-3">{FORESHADOW_STATUS_LABEL[item.status]}</span>
                    </span>
                    {item.description ? (
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-2">{item.description}</span>
                    ) : null}
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
