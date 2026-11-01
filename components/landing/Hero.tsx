import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { isPublicSite } from "@/lib/public-site";
import { EditorMockup } from "./EditorMockup";
import { GitHubMark } from "./GitHubMark";
import { GITHUB_URL, VERSION } from "./constants";

const NOTES = [
  { kicker: "稿子", title: "留在自己的电脑", detail: "设定、档案和对话都在本地，不经过别人的服务器。" },
  { kicker: "改动", title: "你点头才落笔", detail: "AI 先给出一段一段的差异，接受或拒绝由你决定。" },
  { kicker: "模型", title: "随时可以换", detail: "DeepSeek、通义、Kimi，或你自己的本地模型，都能接。" },
] as const;

const PRIMARY_LINK =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-[15px] font-medium text-accent-ink shadow-card transition-colors hover:bg-accent-hover";
const SECONDARY_LINK =
  "inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface px-5 text-[15px] font-medium text-ink shadow-xs transition-colors hover:border-line-strong hover:bg-surface-2";

/** 首页首屏：书口式标题、三条原则，以及写作台示意。 */
export function Hero() {
  return (
    <section className="relative overflow-hidden" id="top">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[52rem] -translate-x-1/2 rounded-full bg-accent/[0.05] blur-3xl" />
        <div className="absolute -right-32 top-24 size-72 rounded-full bg-jade/[0.07] blur-3xl" />
      </div>

      <p
        aria-hidden
        className="pointer-events-none absolute left-3 top-28 hidden font-serif text-[13px] tracking-[0.45em] text-ink-4 xl:block"
        style={{ writingMode: "vertical-rl" }}
      >
        书稿留在自己的抽屉里
      </p>

      <div className="relative mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-14 lg:pt-20">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:gap-14">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-[11.5px] text-ink-3 shadow-xs backdrop-blur">
              <span className="relative flex size-1.5" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-jade opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-jade" />
              </span>
              砚田 {VERSION} · 源码公开 · 还在写
            </span>

            <h1 className="mt-6 font-serif text-[36px] leading-[1.16] tracking-tight text-ink sm:text-[52px] lg:text-[60px]">
              把 AI 请进书房，
              <br />
              写完
              <span className="text-accent">这一本长篇</span>
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-8 text-ink-2">
              砚田是一间本地的小说工作台。稿子和设定放在你自己的电脑里，模型想换就换。它不会擅自改你的正文。
            </p>

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              {isPublicSite ? (
                <a href="#how" className={`${PRIMARY_LINK} w-full sm:w-auto`}>
                  在自己的电脑上开始
                  <ArrowRight className="size-4" aria-hidden />
                </a>
              ) : (
                <Link href="/library" className={`${PRIMARY_LINK} w-full sm:w-auto`}>
                  开始写作
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={`${SECONDARY_LINK} w-full sm:w-auto`}>
                <GitHubMark className="size-4" />
                看源码
              </a>
            </div>
            <p className="mt-4 text-[12px] text-ink-3">
              {isPublicSite
                ? "这个网站只是介绍。写作台在你自己的电脑上打开，不用注册。"
                : "不用注册，也不用登录。一条命令，就在自己的电脑上打开。"}
            </p>
          </div>

          <aside className="relative">
            <div className="rounded-xl border border-line bg-surface/80 p-5 shadow-paper backdrop-blur-sm sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-serif text-[22px] tracking-[0.18em] text-ink">砚田</p>
                  <p className="mt-1 text-[12px] leading-6 text-ink-3">写长篇用的本地工作台</p>
                </div>
                <span
                  aria-hidden
                  className="flex size-[4.5rem] shrink-0 -rotate-6 items-center justify-center rounded-sm border-2 border-accent/80 font-serif text-[15px] tracking-[0.2em] text-accent"
                >
                  本地
                </span>
              </div>
              <ol className="mt-5 space-y-3 border-t border-line pt-4">
                {NOTES.map((note, index) => (
                  <li key={note.kicker} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                    <span className="row-span-2 font-serif text-[18px] leading-none text-accent/80">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[13.5px] font-medium text-ink">{note.title}</span>
                    <span className="text-[12px] leading-5 text-ink-3">{note.detail}</span>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>

        <figure className="mt-12 sm:mt-16">
          <EditorMockup />
          <figcaption className="mt-3 flex items-center justify-between gap-3 px-1 text-[11.5px] text-ink-3">
            <span>示意 · 《潮信》第一章</span>
            <span className="hidden sm:inline">左目录，中正文，右助手。真正的写作台长这样。</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
