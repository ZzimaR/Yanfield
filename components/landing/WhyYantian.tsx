import * as React from "react";
import { Check, Database, GitBranch, KeyRound, LockKeyhole, SlidersHorizontal, X } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

interface Reason {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  cloud: string;
  yantian: string;
}

const REASONS: Reason[] = [
  {
    icon: LockKeyhole,
    title: "数据主权",
    cloud: "书稿存在别人的服务器上，导出、备份、迁移都要看产品脸色。",
    yantian: "书稿、设定、档案都在本机 SQLite 里。复制一个文件就是完整备份，扔进 git 还能看历史。",
  },
  {
    icon: SlidersHorizontal,
    title: "可换模型",
    cloud: "模型绑定在订阅里，涨价、限流、下架时只能跟着迁就。",
    yantian: "对话模型与正文模型分开配置。OpenAI 兼容、Anthropic、Gemini、Ollama 随时换，成本自己算。",
  },
  {
    icon: KeyRound,
    title: "提示词白盒",
    cloud: "提示词藏在内核里，效果不对时只能反复试，不知道它到底被交代了什么。",
    yantian: "内置 19 个预设全部可读可改，可版本化、可 diff、可恢复默认，也可导入导出。",
  },
  {
    icon: GitBranch,
    title: "可 diff 可回滚",
    cloud: "AI 直接重写整段，撤销靠手速，写得越久越不敢让它碰。",
    yantian: "每一次 AI 产出都是逐块 diff，接受或拒绝由你决定；章节有版本快照，写坏了随时退回。",
  },
  {
    icon: Database,
    title: "源码公开",
    cloud: "闭源订阅制，功能取舍由厂商决定，出问题只能等更新。",
    yantian: "源码公开，PolyForm Noncommercial 协议：可以自己用、改、自部署，不能商用。",
  },
];

/** 「为什么是砚田」：痛点与差异对照区。 */
export function WhyYantian() {
  return (
    <section id="why" className="border-y border-line bg-surface-2/35">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.78fr_1.22fr] lg:gap-14 lg:py-24">
        <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
          <SectionHeading
            align="left"
            eyebrow="为什么是砚田"
            title="写作者的稿子，应该放在写作者自己的抽屉里"
            description="市面上的 AI 写作工具大多替你做决定：模型、提示词、数据放哪、改稿方式。砚田反过来——把选择权交还给你。"
          />
          <ul className="mt-1 space-y-2.5">
            <li className="flex items-start gap-2 text-[13px] leading-6 text-ink-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-jade" aria-hidden />
              不用注册账号，也没有云端同步这一说。
            </li>
            <li className="flex items-start gap-2 text-[13px] leading-6 text-ink-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-jade" aria-hidden />
              模型费用直接付给模型服务商，没有中间层。
            </li>
            <li className="flex items-start gap-2 text-[13px] leading-6 text-ink-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-jade" aria-hidden />
              你甚至可以把它跑在断网的局域网里，配一个本地 Ollama。
            </li>
          </ul>
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-card">
          <div className="hidden grid-cols-[1.1fr_1fr_1.1fr] items-center gap-3 border-b border-line bg-surface-2/70 px-4 py-2.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-3 sm:grid">
            <span>维度</span>
            <span>常见的云端 AI 写作</span>
            <span className="text-accent">砚田 Yanfield</span>
          </div>
          <ul className="divide-y divide-line">
            {REASONS.map(({ icon: Icon, title, cloud, yantian }) => (
              <li key={title} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[1.1fr_1fr_1.1fr] sm:items-start sm:gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-ink-3">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="text-[13px] font-medium text-ink">{title}</span>
                </div>
                <p className="flex items-start gap-1.5 pl-8 text-[12px] leading-6 text-ink-3 sm:pl-0">
                  <X className="mt-1 size-3 shrink-0 text-ink-3" aria-hidden />
                  {cloud}
                </p>
                <p className="flex items-start gap-1.5 pl-8 text-[12px] leading-6 text-ink-2 sm:pl-0">
                  <Check className="mt-1 size-3 shrink-0 text-jade" aria-hidden />
                  {yantian}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
