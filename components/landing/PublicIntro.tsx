import { ArrowRight, BookOpenText, Eye, FileDiff, Layers, ListTree, Users } from "lucide-react";
import editorPreview from "../../docs/screenshots/03-editor-blue.png";
import { InkstoneMark } from "@/components/brand/InkstoneMark";
import { FAQ } from "./FAQ";
import { GitHubMark } from "./GitHubMark";
import { HowItWorks } from "./HowItWorks";
import { ThemeToggle } from "./ThemeToggle";
import { GITHUB_URL } from "./constants";

const FEATURES = [
  {
    icon: BookOpenText,
    title: "三栏写作",
    detail: "左边是目录、章纲、设定和档案，中间写正文，右边是助手。查、写、改都在同一屏。",
  },
  {
    icon: FileDiff,
    title: "改动先给你看",
    detail: "AI 不会直接改稿。每一段差异单独列出，接受、拒绝，或只留下其中一块。",
  },
  {
    icon: ListTree,
    title: "书、卷、章三层大纲",
    detail: "先定全书主线，再拆卷和章。写的时候能回到这一章要完成的事。",
  },
  {
    icon: Eye,
    title: "设定全知，标注揭示",
    detail: "AI 能看到全部设定来保证前后一致；还没写到的人物与线索会被标注「尚未揭示」，只用来埋伏笔，不会提前说破。",
  },
  {
    icon: Layers,
    title: "故事档案",
    detail: "每章记下人物状态、设定变化和时间线。长篇写久了，用来对一下有没有写崩。",
  },
  {
    icon: Users,
    title: "模型随你换",
    detail: "DeepSeek、通义、Kimi，或本机的模型都能接。稿子存在你自己的电脑里。",
  },
] as const;

/** 给 yanfield.com 看的介绍页。本机预览在 /intro，不会代替写作台首页。 */
export function PublicIntro() {
  const previewSrc = typeof editorPreview === "string" ? editorPreview : editorPreview.src;

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2">
            <InkstoneMark className="size-7" />
            <span className="font-serif text-[16px] tracking-[0.12em]">砚田</span>
          </a>
          <nav className="flex items-center gap-1 text-[13px] text-ink-2" aria-label="介绍页导航">
            <a href="#features" className="rounded-sm px-2 py-1 hover:text-ink">
              功能
            </a>
            <a href="#how" className="rounded-sm px-2 py-1 hover:text-ink">
              安装
            </a>
            <a href="#faq" className="hidden rounded-sm px-2 py-1 hover:text-ink sm:inline">
              常见问题
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-sm px-2 py-1 hover:text-ink">
              <GitHubMark className="size-3.5" />
              源码
            </a>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="mx-auto w-full max-w-5xl px-4 pb-4 pt-14 sm:px-6 sm:pt-20">
          <h1 className="max-w-3xl font-serif text-[40px] leading-[1.15] text-ink sm:text-[56px]">
            把 AI 请进书房，
            <br />
            写完<span className="text-accent">这一本长篇</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-8 text-ink-2">
            砚田是装在你自己电脑上的小说工作台。目录、正文和助手在同一屏，改动要你点头才落笔。
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="#features"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-[15px] font-medium text-accent-ink hover:bg-accent-hover"
            >
              先看功能
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line bg-surface px-5 text-[15px] text-ink hover:bg-surface-2"
            >
              <GitHubMark className="size-4" />
              看源码
            </a>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="font-serif text-[28px] text-ink sm:text-[34px]">写作时实际会用到的</h2>
          <p className="mt-2 max-w-xl text-[14px] leading-7 text-ink-3">下面这张是写作台本身，不是示意图。</p>
          <figure className="mt-6 overflow-hidden rounded-xl border border-line bg-surface shadow-paper">
            <img src={previewSrc} alt="砚田写作台：左侧目录，中间正文，右侧 AI 助手" className="w-full" />
          </figure>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, detail }) => (
              <li key={title} className="flex gap-3 rounded-lg border border-line bg-surface px-4 py-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-[14.5px] font-medium text-ink">{title}</span>
                  <span className="mt-1 block text-[13px] leading-6 text-ink-3">{detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
            <HowItWorks compact />
            <FAQ compact />
          </div>
        </section>
      </main>
    </div>
  );
}
