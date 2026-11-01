"use client";

import * as React from "react";
import { estimateAiCost, formatCny, type TokenPrice } from "@/lib/ai/cost";
import { formatTokens } from "./utils";

export function describeAiSpend(promptTokens: number, completionTokens: number, price: TokenPrice): string {
  const tokens = `输入 ${formatTokens(promptTokens)} · 输出 ${formatTokens(completionTokens)}`;
  const cost = estimateAiCost(promptTokens, completionTokens, price);
  return cost == null ? tokens : `${tokens} · 约 ${formatCny(cost)}`;
}

export function AiSpendLine({
  promptTokens,
  completionTokens,
  calls,
  price,
  prefix,
}: {
  promptTokens: number;
  completionTokens: number;
  calls?: number;
  price: TokenPrice;
  prefix: string;
}) {
  const detail = describeAiSpend(promptTokens, completionTokens, price);
  const times = calls != null ? ` · ${calls} 次` : "";
  return (
    <p className="text-[12.5px] tabular-nums text-ink-2">
      <span className="text-ink-3">{prefix}</span>
      {detail}
      {times}
    </p>
  );
}
