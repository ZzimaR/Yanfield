"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, ScrollText } from "lucide-react";
import { Skeleton } from "@/components/ui/kit";
import { useApi } from "@/lib/client/api";
import type { ChapterBlueprint, NovelOutline, VolumeOutline } from "@/lib/types";
import { toOne } from "@/lib/editor/normalize";

interface OutlinePanelProps {
  novelId: string;
  chapterId: string | null;
  /** 当前章节所属卷（未分卷为 null） */
  volumeId: string | null;
}

/** 跳转到大纲页的小链接 */
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
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line px-3 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{title}</h3>
        <JumpLink href={href}>编辑</JumpLink>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  const text = typeof value === "number" ? String(value) : (value ?? "").trim();
  if (!text) return null;
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[10.5px] text-ink-4">{label}</div>
      <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-2">{text}</p>
    </div>
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

/** 左栏「大纲速览」：总纲 / 卷纲 / 章纲 只读摘要 */
export function OutlinePanel({ novelId, chapterId, volumeId }: OutlinePanelProps) {
  const novelApi = useApi<unknown>(`/api/outlines/novel/${novelId}`);
  const volumeApi = useApi<unknown>(volumeId ? `/api/outlines/volume/${volumeId}` : null);
  const blueprintApi = useApi<unknown>(chapterId ? `/api/chapters/${chapterId}/blueprint` : null);

  const novelOutline = toOne<NovelOutline>(novelApi.data);
  const volumeOutline = toOne<VolumeOutline>(volumeApi.data);
  const blueprint = toOne<ChapterBlueprint>(blueprintApi.data);

  const href = `/novel/${novelId}/outline`;

  return (
    <div className="min-h-0">
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2 text-[11px] text-ink-4">
        <ScrollText className="size-3.5" aria-hidden />
        只读速览 · 在大纲页编辑
      </div>

      <Section title="总纲" href={href}>
        {novelApi.loading ? (
          <LoadingLines />
        ) : novelOutline ? (
          <>
            <Field label="一句话前提" value={novelOutline.premise} />
            <Field label="主题" value={novelOutline.theme} />
            <Field label="主情节" value={novelOutline.mainPlot} />
            <Field label="结局" value={novelOutline.ending} />
            {!novelOutline.premise && !novelOutline.theme && !novelOutline.mainPlot && !novelOutline.ending ? (
              <Muted>总纲还是空的，去大纲页写下故事的核心。</Muted>
            ) : null}
          </>
        ) : (
          <Muted>暂无总纲，去大纲页开始搭建。</Muted>
        )}
      </Section>

      <Section title="卷纲" href={href}>
        {volumeId === null ? (
          <Muted>本章未归入任何卷。</Muted>
        ) : volumeApi.loading ? (
          <LoadingLines />
        ) : volumeOutline ? (
          <>
            <Field label="卷摘要" value={volumeOutline.summary} />
            <Field label="卷弧线目标" value={volumeOutline.arcGoal} />
            {volumeOutline.keyEvents.length > 0 ? (
              <div className="mb-2">
                <div className="text-[10.5px] text-ink-4">关键事件</div>
                <ul className="mt-0.5 space-y-0.5">
                  {volumeOutline.keyEvents.slice(0, 4).map((event, index) => (
                    <li key={index} className="flex gap-1 text-[12px] leading-relaxed text-ink-2">
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-ink-4" aria-hidden />
                      <span>{event}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!volumeOutline.summary && !volumeOutline.arcGoal ? <Muted>这一卷还没有卷纲。</Muted> : null}
          </>
        ) : (
          <Muted>这一卷还没有卷纲。</Muted>
        )}
      </Section>

      <Section title="本章章纲" href={href}>
        {chapterId === null ? (
          <Muted>先选择一个章节。</Muted>
        ) : blueprintApi.loading ? (
          <LoadingLines />
        ) : blueprint ? (
          <>
            <Field label="本章目标" value={blueprint.goal} />
            <Field label="视角" value={blueprint.pov} />
            <Field label="核心冲突" value={blueprint.conflict} />
            <Field label="情绪曲线" value={blueprint.emotionalArc} />
            <Field label="目标字数" value={blueprint.targetWords || null} />
            {blueprint.scenes.length > 0 ? (
              <div className="mb-2">
                <div className="text-[10.5px] text-ink-4">场景（{blueprint.scenes.length}）</div>
                <ul className="mt-0.5 space-y-1">
                  {blueprint.scenes.slice(0, 5).map((scene) => (
                    <li key={scene.id} className="text-[12px] leading-relaxed text-ink-2">
                      <span className="font-medium">{scene.title}</span>
                      {scene.summary ? <span className="text-ink-3"> · {scene.summary}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!blueprint.goal && !blueprint.conflict && blueprint.scenes.length === 0 ? (
              <Muted>本章还没有章纲。</Muted>
            ) : null}
          </>
        ) : (
          <Muted>本章还没有章纲，去大纲页补上再写正文。</Muted>
        )}
      </Section>
    </div>
  );
}
