"use client";

/**
 * 角色卡：名字首字 + 角色色圆底、定位 Badge、关系数、标签与 AI 可见状态
 */
import { Network, Pin } from "lucide-react";
import { Badge, Card } from "@/components/ui/kit";
import { CHARACTER_ROLE_LABEL, type Character } from "@/lib/types";
import { cn } from "@/lib/ui/cn";
import { ROLE_BADGE_TONE } from "@/components/outline/form-kit";

const AVATAR_TONE: Record<string, string> = {
  protagonist: "bg-accent-soft text-accent",
  antagonist: "bg-surface-3 text-danger",
  supporting: "bg-jade-soft text-jade",
  mentor: "bg-gold-soft text-gold",
  ensemble: "bg-surface-3 text-ink-2",
  other: "bg-surface-3 text-ink-2",
};

export function CharacterCard({
  character,
  onClick,
}: {
  character: Character;
  onClick: () => void;
}) {
  const initial = character.name.trim().slice(0, 1) || "?";
  const roleLabel = CHARACTER_ROLE_LABEL[character.role] ?? "其他";
  const visibleTags = character.tags.slice(0, 3);
  const extraTags = character.tags.length - visibleTags.length;

  return (
    <Card
      padded={false}
      hover
      as="button"
      onClick={onClick}
      className="group flex w-full flex-col gap-2.5 px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full font-serif text-[16px] font-semibold",
            AVATAR_TONE[character.role] ?? AVATAR_TONE.other,
          )}
          aria-hidden
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-medium text-ink">{character.name || "未命名角色"}</span>
            {character.pinned ? <Pin className="size-3 shrink-0 text-gold" /> : null}
            <Badge tone={ROLE_BADGE_TONE[character.role] ?? "default"}>{roleLabel}</Badge>
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-ink-3">{character.identity || "身份待填"}</p>
        </div>
      </div>

      {character.personality ? (
        <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-2">{character.personality}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
          <Network className="size-3" />
          {character.relations.length} 个关系
        </span>
        {visibleTags.map((tag) => (
          <span key={tag} className="rounded-xs bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-ink-3">
            {tag}
          </span>
        ))}
        {extraTags > 0 ? <span className="text-[10.5px] text-ink-3">+{extraTags}</span> : null}
        {!character.aiVisible ? <Badge tone="default">AI 不可见</Badge> : null}
        {character.revealAtChapter !== null ? <Badge tone="gold">第 {character.revealAtChapter} 章揭示</Badge> : null}
      </div>
    </Card>
  );
}
