"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Library, Users } from "lucide-react";
import { Badge, Skeleton } from "@/components/ui/kit";
import { useApi } from "@/lib/client/api";
import { formatRelativeTime } from "@/lib/ui/cn";
import {
  CHARACTER_ROLE_LABEL,
  WORLD_CATEGORY_LABEL,
  type ChapterBlueprint,
  type Character,
  type StoryArchive,
  type WorldSetting,
} from "@/lib/types";
import { toItems, toOne } from "@/lib/editor/normalize";

interface ResearchPanelProps {
  novelId: string;
  chapterId: string | null;
}

const MAX_ITEMS = 10;

function JumpLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-accent transition-opacity duration-150 hover:opacity-80"
    >
      {children}
      <ChevronRight className="size-3" aria-hidden />
    </Link>
  );
}

function Section({
  title,
  href,
  hint,
  children,
}: {
  title: string;
  href: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line px-3 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-baseline gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
          {title}
          {hint ? <span className="text-[10px] font-normal normal-case tracking-normal text-ink-4">{hint}</span> : null}
        </h3>
        <JumpLink href={href}>查看</JumpLink>
      </div>
      {children}
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-[11.5px] leading-relaxed text-ink-4">{children}</p>;
}

function LoadingLines() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}

function archiveTone(status: StoryArchive["status"]): { tone: "jade" | "gold" | "default"; label: string } {
  if (status === "fresh") return { tone: "jade", label: "已同步" };
  if (status === "stale") return { tone: "gold", label: "待更新" };
  return { tone: "default", label: "生成中" };
}

/** 左栏「资料」：本章章纲 + 关联档案摘要 + 角色/设定前 10 条 */
export function ResearchPanel({ novelId, chapterId }: ResearchPanelProps) {
  const blueprintApi = useApi<unknown>(chapterId ? `/api/chapters/${chapterId}/blueprint` : null);
  const archiveApi = useApi<unknown>(
    chapterId
      ? `/api/archives?novelId=${encodeURIComponent(novelId)}&chapterId=${encodeURIComponent(chapterId)}`
      : `/api/archives?novelId=${encodeURIComponent(novelId)}`,
  );
  const characterApi = useApi<unknown>(`/api/characters?novelId=${encodeURIComponent(novelId)}`);
  const worldApi = useApi<unknown>(`/api/world?novelId=${encodeURIComponent(novelId)}`);

  const blueprint = toOne<ChapterBlueprint>(blueprintApi.data);
  const archives = toItems<StoryArchive>(archiveApi.data);
  const characters = toItems<Character>(characterApi.data);
  const settings = toItems<WorldSetting>(worldApi.data);

  // 本章关联档案：优先 chapterId 精确匹配，否则取最新一条
  const archive =
    archives.find((item) => chapterId !== null && item.chapterId === chapterId) ?? archives[0] ?? null;
  const archiveMeta = archive ? archiveTone(archive.status) : null;

  const bibleHref = `/novel/${novelId}/bible`;
  const outlineHref = `/novel/${novelId}/outline`;
  const archivesHref = `/novel/${novelId}/archives`;

  return (
    <div className="min-h-0">
      <Section title="本章章纲" href={outlineHref}>
        {chapterId === null ? (
          <Muted>先选择一个章节。</Muted>
        ) : blueprintApi.loading ? (
          <LoadingLines />
        ) : blueprint ? (
          <div className="space-y-1.5">
            {blueprint.goal ? (
              <div>
                <div className="text-[10.5px] text-ink-4">目标</div>
                <p className="text-[12.5px] leading-relaxed text-ink-2">{blueprint.goal}</p>
              </div>
            ) : null}
            {blueprint.conflict ? (
              <div>
                <div className="text-[10.5px] text-ink-4">冲突</div>
                <p className="text-[12.5px] leading-relaxed text-ink-2">{blueprint.conflict}</p>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-3">
              {blueprint.pov ? <span>视角：{blueprint.pov}</span> : null}
              {blueprint.targetWords ? <span>目标：{blueprint.targetWords} 字</span> : null}
              {blueprint.scenes.length > 0 ? <span>{blueprint.scenes.length} 个场景</span> : null}
            </div>
            {!blueprint.goal && !blueprint.conflict && blueprint.scenes.length === 0 ? (
              <Muted>本章章纲还是空的。</Muted>
            ) : null}
          </div>
        ) : (
          <Muted>本章还没有章纲。</Muted>
        )}
      </Section>

      <Section title="关联档案" href={archivesHref}>
        {archiveApi.loading ? (
          <LoadingLines />
        ) : archive ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {archiveMeta ? <Badge tone={archiveMeta.tone}>{archiveMeta.label}</Badge> : null}
              <span className="text-[10.5px] text-ink-4">{formatRelativeTime(archive.updatedAt)}</span>
            </div>
            <p className="line-clamp-6 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-2">
              {archive.chapterSummary || "档案还没有摘要。"}
            </p>
            {archives.length > 1 ? (
              <p className="text-[10.5px] text-ink-4">共 {archives.length} 条档案</p>
            ) : null}
          </div>
        ) : (
          <Muted>本章还没有生成故事档案，写完这章后可以让 AI 归档。</Muted>
        )}
      </Section>

      <Section title="角色" href={bibleHref} hint={characters.length > 0 ? `${characters.length} 人` : undefined}>
        {characterApi.loading ? (
          <LoadingLines />
        ) : characters.length === 0 ? (
          <Muted>还没有角色卡。</Muted>
        ) : (
          <ul className="space-y-1">
            {characters.slice(0, MAX_ITEMS).map((character) => (
              <li key={character.id} className="flex items-center gap-2">
                <Users className="size-3 shrink-0 text-ink-4" aria-hidden />
                <span className="truncate text-[12.5px] text-ink-2">{character.name}</span>
                <span className="ml-auto shrink-0 text-[10.5px] text-ink-4">
                  {CHARACTER_ROLE_LABEL[character.role] ?? character.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="设定" href={bibleHref} hint={settings.length > 0 ? `${settings.length} 条` : undefined}>
        {worldApi.loading ? (
          <LoadingLines />
        ) : settings.length === 0 ? (
          <Muted>还没有世界观设定。</Muted>
        ) : (
          <ul className="space-y-1">
            {settings.slice(0, MAX_ITEMS).map((setting) => (
              <li key={setting.id} className="flex items-center gap-2">
                <Library className="size-3 shrink-0 text-ink-4" aria-hidden />
                <span className="truncate text-[12.5px] text-ink-2">{setting.title}</span>
                <span className="ml-auto shrink-0 text-[10.5px] text-ink-4">
                  {WORLD_CATEGORY_LABEL[setting.category] ?? setting.category}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
