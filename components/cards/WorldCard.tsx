"use client";

/**
 * 世界观设定卡：分类 Badge、标题、摘要、层级与渐进披露状态
 */
import { CornerDownRight, Pin, Sparkles } from "lucide-react";
import { Badge, Card } from "@/components/ui/kit";
import { WORLD_CATEGORY_LABEL, type WorldSetting } from "@/lib/types";
import { cn } from "@/lib/ui/cn";
import { CATEGORY_BADGE_TONE } from "@/components/outline/form-kit";

export function WorldCard({
  setting,
  parentTitle,
  childCount,
  depth = 0,
  active,
  onClick,
}: {
  setting: WorldSetting;
  parentTitle?: string;
  childCount?: number;
  depth?: number;
  active?: boolean;
  onClick: () => void;
}) {
  const categoryLabel = WORLD_CATEGORY_LABEL[setting.category] ?? "自定义";

  return (
    <Card
      padded={false}
      hover
      as="button"
      onClick={onClick}
      className={cn(
        "group flex w-full flex-col gap-2 px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
        active ? "border-accent bg-accent-soft/30" : null,
      )}
    >
      <div className="flex items-center gap-1.5">
        {depth > 0 ? <CornerDownRight className="size-3 shrink-0 text-ink-3" aria-hidden /> : null}
        <span className="truncate text-[13.5px] font-medium text-ink">{setting.title || "未命名设定"}</span>
        {setting.pinned ? <Pin className="size-3 shrink-0 text-gold" /> : null}
        <Badge tone={CATEGORY_BADGE_TONE[setting.category] ?? "default"}>{categoryLabel}</Badge>
        <span className="ml-auto shrink-0 text-[10.5px] text-ink-3">
          {parentTitle ? `隶属 ${parentTitle}` : ""}
          {!parentTitle && childCount ? `${childCount} 个子条目` : ""}
        </span>
      </div>

      {setting.summary ? (
        <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-2">{setting.summary}</p>
      ) : (
        <p className="text-[12px] text-ink-3">还没有摘要，点开补充这条设定的要点。</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {setting.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="rounded-xs bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-ink-3">
            {tag}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] text-ink-3">
          <Sparkles className="size-2.5" />
          {setting.aiVisible ? "AI 可见" : "AI 不可见"}
        </span>
        {setting.revealAtChapter !== null ? <Badge tone="gold">第 {setting.revealAtChapter} 章揭示</Badge> : null}
      </div>
    </Card>
  );
}
