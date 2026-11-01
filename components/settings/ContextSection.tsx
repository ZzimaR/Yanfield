"use client";

import * as React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button, Card, Input, Segmented, Slider, Switch, Textarea, useToast } from "@/components/ui/kit";
import { useApi } from "@/lib/client/api";
import { DEFAULT_CONTEXT_CONFIG, type AppSettings, type ContextConfig, type DashboardStats } from "@/lib/types";
import { cn } from "@/lib/ui/cn";
import { AiSpendLine } from "@/components/ai/AiSpendLine";

export interface ContextSectionProps {
  settings: AppSettings | undefined;
  update: (patch: Partial<AppSettings>) => void;
}

type BoolKey =
  | "includeNovelOutline"
  | "includeVolumeOutline"
  | "includeChapterBlueprint"
  | "includeArchives"
  | "includeCharacters"
  | "includeWorld"
  | "includeForeshadows"
  | "includeStyleGuide"
  | "includeSelection";

const CONTEXT_SWITCHES: { key: BoolKey; label: string; hint: string }[] = [
  { key: "includeNovelOutline", label: "全书大纲", hint: "主线、主题、结局方向" },
  { key: "includeVolumeOutline", label: "本卷大纲", hint: "当前卷的弧线与关键事件" },
  { key: "includeChapterBlueprint", label: "本章蓝图", hint: "本章目标、冲突、场景节拍" },
  { key: "includeArchives", label: "故事档案", hint: "角色状态、设定变化、数值总账" },
  { key: "includeCharacters", label: "角色卡", hint: "相关角色的档案与关系" },
  { key: "includeWorld", label: "世界设定", hint: "地点、体系、势力等硬设定" },
  { key: "includeForeshadows", label: "伏笔账本", hint: "未回收的伏笔与提示" },
  { key: "includeStyleGuide", label: "文风指南", hint: "作品的语气、视角、禁忌词" },
  { key: "includeSelection", label: "当前选中文本", hint: "在编辑器里选中一段再让 AI 处理" },
];

const CUSTOM_INSTRUCTION_LIMIT = 600;

/** 上下文预算常用档位（token）。0 = 不限制。 */
const BUDGET_PRESETS: { value: number; label: string }[] = [
  { value: 4000, label: "4k" },
  { value: 8000, label: "8k" },
  { value: 12000, label: "12k" },
  { value: 24000, label: "24k" },
  { value: 48000, label: "48k" },
  { value: 96000, label: "96k" },
  { value: 0, label: "不限" },
];

function budgetLabel(value: number): string {
  return value === 0 ? "不限" : `${Math.round(value / 1000)}k tokens`;
}

export function ContextSection({ settings, update }: ContextSectionProps) {
  const { toast } = useToast();
  const statsApi = useApi<DashboardStats>("/api/stats");
  if (!settings) return null;
  const context = settings.defaultContext;
  const pricing = settings.aiPricing;
  const stats = statsApi.data;

  const patchContext = (patch: Partial<ContextConfig>) => {
    update({ defaultContext: { ...context, ...patch } });
  };

  const reset = () => {
    update({ defaultContext: DEFAULT_CONTEXT_CONFIG });
    toast({ title: "已恢复默认上下文配置", description: "改动会自动保存。", tone: "success" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg text-ink">AI 与上下文</h2>
          <p className="mt-1 text-[12px] leading-6 text-ink-3">
            每次 AI 请求会按这里的开关装配上下文。素材可见、预算可控，写长篇才不会越写越跑偏。
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={<RotateCcw className="size-3.5" />} onClick={reset}>
          恢复默认
        </Button>
      </div>

      <Card className="p-4">
        <h3 className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <SlidersHorizontal className="size-3.5 text-ink-3" aria-hidden />
          上下文组成
        </h3>
        <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {CONTEXT_SWITCHES.map(({ key, label, hint }) => (
            <Switch
              key={key}
              checked={context[key]}
              label={label}
              hint={hint}
              onChange={(checked) => patchContext({ [key]: checked } as Partial<ContextConfig>)}
            />
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-[13px] font-medium text-ink">上下文预算与策略</h3>
        <p className="mt-1 text-[11.5px] leading-5 text-ink-3">
          装配器按优先级把大纲、档案、角色、设定塞进预算：超出时先丢弃低优先级块，再截断最长的块。预算上限由模型上下文窗口决定。
        </p>
        <div className="mt-4 space-y-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11.5px] text-ink-3">上下文预算</p>
              <span className="font-mono text-[11.5px] text-accent">{budgetLabel(context.contextBudget)}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {BUDGET_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => patchContext({ contextBudget: preset.value })}
                  className={cn(
                    "rounded-sm border px-2 py-1 font-mono text-[11px] transition-colors",
                    context.contextBudget === preset.value
                      ? "border-accent/60 bg-accent-soft text-accent"
                      : "border-line bg-surface-2/70 text-ink-3 hover:border-line-strong hover:text-ink",
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <Input
              className="mt-2"
              label="自定义预算（tokens）"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={context.contextBudget === 0 ? "" : String(context.contextBudget)}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                patchContext({ contextBudget: Number.isFinite(parsed) && parsed > 0 ? parsed : 0 });
              }}
              placeholder="自定义，例如 16000"
              hint="0 = 不限制（由模型上下文窗口决定上限）"
            />
          </div>
          <div className="h-px bg-line/70" />
          <Slider
            label="单次输出上限（0 = 模型默认）"
            min={0}
            max={16000}
            step={250}
            value={context.maxTokens}
            hint={context.maxTokens === 0 ? "模型默认" : `${context.maxTokens} tokens`}
            onChange={(value) => patchContext({ maxTokens: value })}
          />
          <Slider
            label="前情摘要章数"
            min={0}
            max={10}
            step={1}
            value={context.includeChapterSummaries && context.includeChapterSummaries > 0 ? context.includeChapterSummaries : 0}
            hint={context.includeChapterSummaries === 0 ? "不包含" : `最近 ${context.includeChapterSummaries} 章`}
            onChange={(value) => patchContext({ includeChapterSummaries: value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11.5px] text-ink-3">前情摘要形式</p>
              <Segmented
                options={[
                  { value: "summary", label: "摘要" },
                  { value: "tail", label: "章末片段" },
                ]}
                value={context.chapterSummaryMode}
                onChange={(value) => patchContext({ chapterSummaryMode: value === "tail" ? "tail" : "summary" })}
              />
            </div>
            <div>
              <p className="mb-1.5 text-[11.5px] text-ink-3">角色卡详细度</p>
              <Segmented
                options={[
                  { value: "brief", label: "精简" },
                  { value: "standard", label: "标准" },
                  { value: "full", label: "完整" },
                ]}
                value={context.characterDetail}
                onChange={(value) =>
                  patchContext({
                    characterDetail: value === "brief" || value === "full" ? value : "standard",
                  })
                }
              />
            </div>
          </div>
          <Slider
            label="档案回溯深度"
            min={1}
            max={6}
            step={1}
            value={context.archiveDepth}
            hint={`最近 ${context.archiveDepth} 章的档案`}
            onChange={(value) => patchContext({ archiveDepth: value })}
          />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h3 className="text-[14px] font-medium text-ink">用量与费用</h3>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-3">
            每次请求优先采用服务商返回的 token。填上你的单价后，这里按人民币估算，实际账单以服务商为准。两项都留 0 则只统计 token。
          </p>
        </div>
        {stats ? (
          <div className="space-y-1">
            <AiSpendLine
              prefix="今日 "
              promptTokens={stats.todayPromptTokens}
              completionTokens={stats.todayCompletionTokens}
              calls={stats.todayAiCalls}
              price={pricing}
            />
            <AiSpendLine
              prefix="累计 "
              promptTokens={stats.aiPromptTokens}
              completionTokens={stats.aiCompletionTokens}
              calls={stats.aiCalls}
              price={pricing}
            />
          </div>
        ) : (
          <p className="text-[12px] text-ink-3">{statsApi.loading ? "正在统计用量…" : "还没有用量记录。"}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="输入单价"
            type="number"
            min={0}
            step="0.01"
            value={pricing.inputPerMillion ? String(pricing.inputPerMillion) : ""}
            placeholder="0"
            hint="元 / 百万 tokens"
            onChange={(event) => {
              const num = event.target.value.trim() === "" ? 0 : Number(event.target.value);
              if (!Number.isFinite(num) || num < 0) return;
              update({ aiPricing: { ...pricing, inputPerMillion: num } });
            }}
          />
          <Input
            label="输出单价"
            type="number"
            min={0}
            step="0.01"
            value={pricing.outputPerMillion ? String(pricing.outputPerMillion) : ""}
            placeholder="0"
            hint="元 / 百万 tokens"
            onChange={(event) => {
              const num = event.target.value.trim() === "" ? 0 : Number(event.target.value);
              if (!Number.isFinite(num) || num < 0) return;
              update({ aiPricing: { ...pricing, outputPerMillion: num } });
            }}
          />
        </div>
      </Card>

      <Card className="p-4">
        <Textarea
          label="自定义指令（追加到每次请求末尾）"
          rows={3}
          maxLength={CUSTOM_INSTRUCTION_LIMIT}
          value={context.customInstruction}
          onChange={(event) => patchContext({ customInstruction: event.target.value })}
          placeholder="例如：保持冷峻克制的语气，不要使用现代网络用语，避免解释性旁白。"
          hint={`${context.customInstruction.length}/${CUSTOM_INSTRUCTION_LIMIT} 字 · 留空则不加`}
        />
      </Card>
    </div>
  );
}
