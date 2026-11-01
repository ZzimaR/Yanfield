import * as React from "react";
import {
  BookOpenText,
  Database,
  EyeOff,
  FileDiff,
  Gauge,
  Layers,
  ListTree,
  Users,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";

interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  hint: string;
}

const FEATURES: Feature[] = [
  {
    icon: BookOpenText,
    title: "三栏沉浸写作",
    description: "左目录、中正文、右 AI，一屏之内完成查、写、改。专注模式自动收起一切多余界面。",
    hint: "目录 · 正文 · AI 面板",
  },
  {
    icon: FileDiff,
    title: "逐块审阅 AI 改动",
    description: "AI 不会直接改你的稿子。每一段改动都以 diff 呈现，接受、拒绝、或只取一半。",
    hint: "diff 接受 / 拒绝",
  },
  {
    icon: Users,
    title: "多智能体协作",
    description: "主编统筹，策划拆解，写作落笔，档案归档，审稿挑刺——同一本书里各司其职。",
    hint: "9 个内置 Agent",
  },
  {
    icon: ListTree,
    title: "三级大纲",
    description: "全书主线、分卷弧线、章节蓝图三层展开，写之前先把结构想清楚，写之后随时回填。",
    hint: "书 / 卷 / 章",
  },
  {
    icon: Layers,
    title: "故事档案",
    description: "本章档案、角色状态、设定变化、数值总账、时间线五块互相校验，长篇不容易写崩。",
    hint: "五块档案",
  },
  {
    icon: Gauge,
    title: "上下文装配预算",
    description: "每次请求花了多少 token、装了什么，一目了然。预算超了会给出降级建议。",
    hint: "可审阅 · 可降级",
  },
  {
    icon: EyeOff,
    title: "设定可见性防剧透",
    description: "还没写到的伏笔和设定不会泄漏给 AI，避免它在第三章就替你把结尾说破。",
    hint: "按章节控制可见",
  },
  {
    icon: Database,
    title: "本地 SQLite 零部署",
    description: "没有 Mongo、没有 Redis、没有中间件。数据是一个文件，复制、迁移、备份都由你说了算。",
    hint: "data/yantian.db",
  },
];

/** 功能区块：8 张卡片，2/3/4 列响应式。 */
export function FeatureGrid() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
      <SectionHeading
        eyebrow="功能"
        title="小说写作里真正费神的部分，砚田都接住了"
        description="不是又一个聊天框套壳。从大纲到档案、从上下文到审阅，每一个环节都为长篇写作设计。"
      />

      <div className="mt-10 grid gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {FEATURES.map(({ icon: Icon, title, description, hint }) => (
          <article
            key={title}
            className="group relative flex flex-col rounded-lg border border-line bg-surface p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card sm:p-5"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-md bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-accent-ink">
                <Icon className="size-4" />
              </span>
              <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-3">{hint}</span>
            </div>
            <h3 className="mt-3.5 text-[14.5px] font-medium text-ink">{title}</h3>
            <p className="mt-1.5 text-[12.5px] leading-6 text-ink-3">{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
