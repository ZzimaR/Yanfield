import * as React from "react";
import { Check, CircleDashed, Loader2 } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

interface Stage {
  version: string;
  state: "done" | "doing" | "planned";
  title: string;
  items: string[];
}

const STAGES: Stage[] = [
  {
    version: "v0.1.0",
    state: "doing",
    title: "当前开发版",
    items: [
      "三栏沉浸写作 + 自动保存",
      "AI 改动逐块 diff 审阅",
      "主编 / 写作 / 设定 三个智能体",
      "三级大纲 · 设定 · 故事档案",
      "11 家模型服务预设接入",
      "上下文预算与分节预览",
      "本地 SQLite、一条命令启动",
    ],
  },
  {
    version: "v0.2",
    state: "planned",
    title: "下一步",
    items: [
      "章节版本快照与回滚",
      "EPUB 导出与写作统计",
      "自定义 Agent 与插件机制",
      "多人协作审校（自托管）",
    ],
  },
  {
    version: "更远",
    state: "planned",
    title: "长期方向",
    items: ["知识图谱页", "爆款仿写工作台", "AI 配图", "Windows 一键启动包"],
  },
];

const STATE_STYLES: Record<Stage["state"], { label: string; badge: string; icon: React.ComponentType<{ className?: string }> }> = {
  done: { label: "已完成", badge: "bg-jade-soft text-jade", icon: Check },
  doing: { label: "开发中", badge: "bg-gold-soft text-gold", icon: Loader2 },
  planned: { label: "计划中", badge: "bg-surface-2 text-ink-3", icon: CircleDashed },
};

/** 路线图。 */
export function Roadmap() {
  return (
    <section id="roadmap" className="border-y border-line bg-surface-2/35">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <SectionHeading
          eyebrow="路线图"
          title="小步快跑，但方向不飘"
          description="先把「写长篇」这件事做扎实，再谈生态。每一条都可以在 GitHub 上讨论或认领。"
        />

        <div className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-3">
          {STAGES.map((stage) => {
            const meta = STATE_STYLES[stage.state];
            const Icon = meta.icon;
            return (
              <article
                key={stage.version}
                className="flex flex-col rounded-lg border border-line bg-surface p-4 shadow-xs sm:p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[12px] tracking-[0.08em] text-ink-2">{stage.version}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${meta.badge}`}>
                    <Icon className="size-2.5" aria-hidden />
                    {meta.label}
                  </span>
                </div>
                <h3 className="mt-2.5 font-serif text-[16px] text-ink">{stage.title}</h3>
                <ul className="mt-3 space-y-1.5">
                  {stage.items.map((item) => (
                    <li key={item} className="flex items-start gap-1.5 text-[12px] leading-6 text-ink-3">
                      <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-line-strong" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
