"use client";

/**
 * 空状态引导：当前智能体的头像 / 问候语 + 最多 4 个快捷提问。
 * 点击快捷提问由面板直接发送（无需手动再点发送）。
 */
import { Lightbulb } from "lucide-react";
import type { AgentDef } from "@/lib/types";
import { cn } from "@/lib/ui/cn";
import { AGENT_TINT_CLASS, agentInitial } from "./utils";

export interface QuickActionsProps {
  agent: AgentDef;
  onPick: (prompt: string) => void;
  disabled?: boolean;
  className?: string;
}

export function QuickActions({ agent, onPick, disabled = false, className }: QuickActionsProps) {
  const tint = AGENT_TINT_CLASS[agent.tint];
  const actions = agent.quickActions.slice(0, 4);

  return (
    <div
      className={cn(
        "fade-in flex flex-col items-center px-4 py-6 text-center",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-lg font-serif text-[20px]",
          tint.avatar,
        )}
        aria-hidden
      >
        {agentInitial(agent)}
      </span>
      <h3 className="mt-3 font-serif text-[17px] text-ink">{agent.name}</h3>
      <p className="mt-0.5 text-[12px] text-ink-4">{agent.role}</p>
      <p className="mt-3 max-w-[320px] whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-3">
        {agent.greeting}
      </p>

      {actions.length > 0 ? (
        <div className="mt-5 grid w-full max-w-[330px] grid-cols-1 gap-1.5 sm:grid-cols-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled={disabled}
              onClick={() => onPick(action.prompt)}
              className="group flex items-start gap-1.5 rounded-md border border-line bg-surface px-2.5 py-2 text-left transition-colors duration-150 hover:border-accent/30 hover:bg-accent-soft focus-visible:border-accent/30 focus-visible:bg-accent-soft focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-ink-4 transition-colors group-hover:text-accent" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-medium text-ink-2 transition-colors group-hover:text-accent">
                  {action.label}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] text-ink-4">
                  {action.prompt}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-[10.5px] text-ink-4">
        也可以直接在下方输入框描述需求，@ 可引用章节 / 角色 / 设定
      </p>
    </div>
  );
}
