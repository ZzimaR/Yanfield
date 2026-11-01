import * as React from "react";
import { Check, ChevronDown, EyeOff, Feather, Gauge, Send, Sparkles, X } from "lucide-react";

const CHAPTERS: { label: string; state: "active" | "done" | "draft" }[] = [
  { label: "第一章 空信", state: "active" },
  { label: "第二章 税册", state: "done" },
  { label: "第三章 纸船", state: "done" },
  { label: "第四章 旧码头", state: "draft" },
  { label: "第五章 回程", state: "draft" },
];

const BUDGET_ROWS = [
  { label: "章节正文", tokens: "2.4k" },
  { label: "前情摘要", tokens: "1.8k" },
  { label: "故事档案", tokens: "1.2k" },
  { label: "角色与设定", tokens: "0.9k" },
] as const;

const AGENT_TABS = ["主编", "策划", "写作", "档案", "审稿"] as const;

/** 纯 HTML/CSS 的三栏编辑器示意图（左目录 / 中正文 / 右 AI 面板）。 */
export function EditorMockup() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div aria-hidden className="absolute -inset-x-4 -top-5 bottom-6 rounded-[28px] bg-surface-2/60 blur-2xl" />
      <div
        aria-hidden
        role="presentation"
        className="relative overflow-hidden rounded-xl border border-line bg-surface shadow-paper"
      >
        {/* 窗口工具条 */}
        <div className="flex h-10 items-center gap-3 border-b border-line bg-surface-2/70 px-3.5 sm:px-4">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
          </div>
          <span className="truncate text-[13px] text-ink-2">潮信 · 第一卷 · 第一章 空信</span>
          <span className="ml-auto hidden items-center gap-2 sm:flex">
            <span className="inline-flex items-center gap-1 rounded-sm border border-jade/25 bg-jade-soft px-1.5 py-0.5 text-[12px] text-jade">
              <Check className="size-2.5" aria-hidden />
              已自动保存
            </span>
            <span className="font-mono text-[12px] text-ink-3">1,842 字</span>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[210px_minmax(0,1fr)_300px]">
          {/* 左：目录 */}
          <aside className="hidden border-r border-line bg-surface-2/40 px-2.5 py-4 md:block">
            <div className="flex items-center justify-between px-1.5">
              <span className="text-[12px] font-medium tracking-[0.12em] text-ink-3">目录</span>
              <span className="font-mono text-[12px] text-ink-3">2 卷 / 37 章</span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 rounded-sm bg-surface px-2 py-1.5 text-[13px] text-ink shadow-xs">
              <ChevronDown className="size-3 text-ink-3" aria-hidden />
              <span className="truncate font-medium">第一卷 · 退潮</span>
            </div>
            <ul className="mt-1 space-y-0.5">
              {CHAPTERS.map((chapter) => (
                <li key={chapter.label}>
                  <div
                    className={[
                      "flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px]",
                      chapter.state === "active" ? "bg-accent-soft text-accent" : "text-ink-3",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden
                      className={[
                        "size-1 shrink-0 rounded-full",
                        chapter.state === "active"
                          ? "bg-accent"
                          : chapter.state === "done"
                            ? "bg-jade"
                            : "bg-line-strong",
                      ].join(" ")}
                    />
                    <span className="truncate">{chapter.label}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-[13px] text-ink-3">
              <ChevronDown className="size-3" aria-hidden />
              第二卷 · 对岸
            </div>
            <div className="mt-4 rounded-md border border-line bg-surface/70 px-2 py-2">
              <div className="flex items-center justify-between text-[12px] text-ink-3">
                <span>本卷进度</span>
                <span className="font-mono">2.1 / 6 万</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full w-[35%] rounded-full bg-jade" />
              </div>
            </div>
          </aside>

          {/* 中：正文 */}
          <div className="min-w-0 bg-surface">
            <div className="flex items-center gap-1 border-b border-line px-3 py-1.5 text-ink-3">
              <span className="rounded-sm px-1.5 py-0.5 text-[13px] text-ink-3">B</span>
              <span className="rounded-sm px-1.5 py-0.5 font-serif text-[13px] italic">I</span>
              <span className="rounded-sm px-1.5 py-0.5 text-[13px]">&ldquo;</span>
              <span className="mx-1 h-3.5 w-px bg-line" aria-hidden />
              <span className="text-[13px]">H2</span>
              <span className="ml-auto inline-flex items-center gap-1 text-[12px]">
                <Sparkles className="size-2.5 text-accent" aria-hidden />
                AI 已就绪
              </span>
            </div>

            <div className="px-4 py-4 sm:px-7 sm:py-6">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-serif text-[22px] leading-tight text-ink">第一章 空信</h3>
                <span className="shrink-0 rounded-sm bg-gold-soft px-1.5 py-0.5 text-[12px] text-gold">写作中</span>
              </div>

              <div className="mt-4 space-y-3 font-serif text-[15px] leading-[1.95] text-ink-2">
                <p>
                  <span className="float-left mr-1.5 mt-1 font-serif text-[40px] leading-[0.85] text-ink">退</span>
                  潮比账本上记的早了两刻。周晚把油布账本摊在石阶上，数到第三封时停住了。
                </p>
                <p>
                  收件人栏写着他自己的名字。他把信翻过去，先登记另外两封，指节却一直按在封皮上。
                </p>
                <p>小满在跳板上问：今天有我的吗。他说没有。</p>
              </div>

              {/* AI 逐块改动建议 */}
              <div className="mt-4 rounded-md border border-accent/25 bg-accent-soft/40">
                <div className="flex items-center gap-1.5 border-b border-accent/15 px-2.5 py-1.5">
                  <Feather className="size-3 text-accent" aria-hidden />
                  <span className="text-[12.5px] font-medium text-accent">AI 建议 · 第 1 段</span>
                  <span className="ml-auto flex items-center gap-1">
                    <span className="inline-flex items-center gap-0.5 rounded-sm bg-success/15 px-1.5 py-0.5 text-[12px] text-success">
                      <Check className="size-2.5" aria-hidden />
                      接受
                    </span>
                    <span className="inline-flex items-center gap-0.5 rounded-sm bg-danger/10 px-1.5 py-0.5 text-[12px] text-danger">
                      <X className="size-2.5" aria-hidden />
                      拒绝
                    </span>
                  </span>
                </div>
                <div className="space-y-1 px-2.5 py-2 font-serif text-[14px] leading-[1.9]">
                  <p>
                    <span className="diff-del">他把信翻过去，先登记另外两封。</span>
                  </p>
                  <p>
                    <span className="diff-add">
                      他把信翻过去，指节在自己的名字上停了一停，才去登记另外两封。
                    </span>
                  </p>
                </div>
              </div>

              {/* 窄屏下的上下文预算条 */}
              <div className="mt-4 flex items-center gap-2 rounded-md border border-line bg-surface-2/60 px-2.5 py-2 lg:hidden">
                <Gauge className="size-3.5 text-jade" aria-hidden />
                <span className="text-[10.5px] text-ink-3">上下文 8.2k / 32k</span>
                <div className="ml-auto h-1 w-20 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full w-[26%] rounded-full bg-jade" />
                </div>
              </div>
            </div>
          </div>

          {/* 右：AI 面板 */}
          <aside className="hidden border-l border-line bg-surface-2/40 lg:flex lg:flex-col">
            <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
              <Sparkles className="size-3.5 text-accent" aria-hidden />
              <span className="text-[14px] font-medium text-ink">AI 助手</span>
              <span className="ml-auto rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[12px] text-ink-3">
                deepseek-v3
              </span>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-line px-3 py-2">
              {AGENT_TABS.map((agent, index) => (
                <span
                  key={agent}
                  className={[
                    "rounded-full border px-2 py-0.5 text-[12px]",
                    index === 0
                      ? "border-accent/30 bg-accent-soft text-accent"
                      : "border-line bg-surface/60 text-ink-3",
                  ].join(" ")}
                >
                  {agent}
                </span>
              ))}
            </div>

            <div className="border-b border-line px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-[12.5px] text-ink-3">
                  <Gauge className="size-3 text-jade" aria-hidden />
                  上下文预算
                </span>
                <span className="font-mono text-[12px] text-ink-3">8.2k / 32k</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full w-[26%] rounded-full bg-jade" />
              </div>
              <ul className="mt-2 space-y-1">
                {BUDGET_ROWS.map((row) => (
                  <li key={row.label} className="flex items-center justify-between text-[12.5px] text-ink-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="size-1 rounded-full bg-line-strong" aria-hidden />
                      {row.label}
                    </span>
                    <span className="font-mono text-ink-3">{row.tokens}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center gap-1 rounded-sm bg-gold-soft/70 px-1.5 py-1 text-[12px] text-gold">
                <EyeOff className="size-2.5" aria-hidden />
                第 5 章之后的设定对 AI 不可见
              </div>
            </div>

            <div className="flex-1 space-y-2.5 px-3 py-3">
              <div className="ml-auto max-w-[92%] rounded-md rounded-br-sm bg-accent px-2.5 py-1.5 text-[13px] leading-6 text-accent-ink">
                这一段把雨夜再压一点，但别丢掉那盏灯。
              </div>
              <div className="max-w-[95%] rounded-md rounded-bl-sm border border-line bg-surface px-2.5 py-1.5 text-[13px] leading-6 text-ink-2 shadow-xs">
                好的。把 &ldquo;压下来&rdquo; 换成一个更慢的动作，让雨和灯形成对照——
                <span className="ml-0.5 inline-block h-3 w-0.5 translate-y-0.5 bg-accent" aria-hidden />
              </div>
              <div className="flex gap-1">
                <span className="rounded-sm border border-line bg-surface px-1.5 py-0.5 text-[12px] text-ink-3">
                  插入正文
                </span>
                <span className="rounded-sm border border-line bg-surface px-1.5 py-0.5 text-[12px] text-ink-3">
                  再来一版
                </span>
              </div>
            </div>

            <div className="border-t border-line px-2.5 py-2">
              <div className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1.5">
                <span className="text-[13px] text-ink-3">告诉 AI 你想怎么写…</span>
                <span className="ml-auto flex size-5 items-center justify-center rounded-sm bg-accent text-accent-ink">
                  <Send className="size-2.5" aria-hidden />
                </span>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
