"use client";

/**
 * 伏笔卡：状态、埋设 / 回收章节关联、说明
 */
import { Link2 } from "lucide-react";
import { Badge, Card } from "@/components/ui/kit";
import type { BadgeTone } from "@/components/ui/kit";
import { FORESHADOW_STATUS_LABEL, type Foreshadow } from "@/lib/types";
import { cn } from "@/lib/ui/cn";
import { stripChapterNumber } from "@/components/outline/form-kit";

const STATUS_TONE: Record<string, BadgeTone> = {
  planted: "gold",
  advanced: "accent",
  paid: "jade",
  dropped: "default",
};

export function ForeshadowCard({
  foreshadow,
  plantedChapter,
  payoffChapter,
  onClick,
  className,
}: {
  foreshadow: Foreshadow;
  plantedChapter?: { orderIndex: number; title: string };
  payoffChapter?: { orderIndex: number; title: string };
  onClick: () => void;
  className?: string;
}) {
  return (
    <Card
      padded={false}
      hover
      as="button"
      onClick={onClick}
      className={cn("flex w-full flex-col gap-1.5 px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60", className)}
    >
      <div className="flex items-center gap-1.5">
        <span className="truncate text-[13.5px] font-medium text-ink">{foreshadow.title || "未命名伏笔"}</span>
        <Badge tone={STATUS_TONE[foreshadow.status] ?? "default"}>{FORESHADOW_STATUS_LABEL[foreshadow.status] ?? "已埋设"}</Badge>
      </div>
      {foreshadow.description ? (
        <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-2">{foreshadow.description}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ink-3">
        <span className="inline-flex items-center gap-1">
          <Link2 className="size-2.5" />
          埋设：
          {plantedChapter
            ? `第 ${plantedChapter.orderIndex + 1} 章 · ${stripChapterNumber(plantedChapter.title)}`
            : "未关联章节"}
        </span>
        <span className="inline-flex items-center gap-1">
          回收：
          {payoffChapter
            ? `第 ${payoffChapter.orderIndex + 1} 章 · ${stripChapterNumber(payoffChapter.title)}`
            : "未安排"}
        </span>
      </div>
    </Card>
  );
}
