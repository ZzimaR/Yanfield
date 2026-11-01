"use client";

import * as React from "react";
import { ArrowUpRight, Check, TerminalSquare, Zap } from "lucide-react";
import { Card } from "@/components/ui/kit";
import { PROVIDER_PRESETS, type ProviderPreset } from "@/lib/defaults";
import { cn } from "@/lib/ui/cn";

export interface ProviderPresetGridProps {
  /** 已存在的服务名称，用于标记「已添加」。 */
  existingNames: string[];
  /** 选中某个服务商预设（custom 表示任意 OpenAI 兼容服务）。 */
  onPick: (preset: ProviderPreset) => void;
}

/** 设置页「模型服务」顶部的品牌快捷添加网格：选品牌 → 粘 Key 即可用。 */
export function ProviderPresetGrid({ existingNames, onPick }: ProviderPresetGridProps) {
  const [showEnvHint, setShowEnvHint] = React.useState(false);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <Zap className="size-3.5 text-accent" aria-hidden />
            快速添加主流服务商
          </h3>
          <p className="mt-1 text-[11.5px] leading-5 text-ink-3">
            选一个品牌，Base URL、接入协议与推荐模型都会自动填好，只需要粘贴 API Key。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowEnvHint((previous) => !previous)}
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <TerminalSquare className="size-3.5" aria-hidden />
          环境变量配置
        </button>
      </div>

      {showEnvHint ? (
        <div className="mt-2.5 rounded-md border border-line bg-surface-2/70 px-3 py-2.5">
          <p className="text-[11px] leading-5 text-ink-3">
            适合 Docker / 服务器部署：启动时读取
            <span className="mx-1 font-mono text-[10.5px] text-ink-2">DEEPSEEK_API_KEY</span>、
            <span className="mx-1 font-mono text-[10.5px] text-ink-2">OPENAI_API_KEY</span>、
            <span className="mx-1 font-mono text-[10.5px] text-ink-2">DASHSCOPE_API_KEY</span>、
            <span className="mx-1 font-mono text-[10.5px] text-ink-2">MOONSHOT_API_KEY</span>、
            <span className="mx-1 font-mono text-[10.5px] text-ink-2">ZHIPU_API_KEY</span>、
            <span className="mx-1 font-mono text-[10.5px] text-ink-2">ANTHROPIC_API_KEY</span>、
            <span className="mx-1 font-mono text-[10.5px] text-ink-2">GEMINI_API_KEY</span>、
            <span className="mx-1 font-mono text-[10.5px] text-ink-2">OPENROUTER_API_KEY</span>、
            <span className="mx-1 font-mono text-[10.5px] text-ink-2">SILICONFLOW_API_KEY</span>
            等环境变量，自动创建对应服务；本机 Ollama 可用
            <span className="mx-1 font-mono text-[10.5px] text-ink-2">OLLAMA_BASE_URL</span>。
          </p>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDER_PRESETS.map((preset) => {
          const added = existingNames.some((name) => name.trim() === preset.name);
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => onPick(preset)}
              className={cn(
                "group flex items-start gap-2.5 rounded-md border border-line bg-surface-2/50 px-2.5 py-2 text-left",
                "transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface hover:shadow-xs",
              )}
            >
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-surface font-serif text-[12px] leading-none text-accent">
                {preset.name.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[12.5px] font-medium text-ink">{preset.name}</span>
                  {added ? <Check className="size-3 shrink-0 text-jade" aria-label="已添加过" /> : null}
                </span>
                <span className="mt-0.5 line-clamp-1 text-[10.5px] leading-4 text-ink-3">{preset.description}</span>
                <span className="mt-0.5 block font-mono text-[9.5px] text-ink-3">
                  {preset.models.length > 0 ? `${preset.models.length} 个推荐模型` : "自定义 Base URL"}
                </span>
              </span>
              <ArrowUpRight
                className="mt-0.5 size-3 shrink-0 text-ink-3 transition-colors group-hover:text-accent"
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </Card>
  );
}
