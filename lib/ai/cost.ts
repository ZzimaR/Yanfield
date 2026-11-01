/** 按用户填写的单价估算费用。单价为 0 时返回 null，表示只统计 token、不显示金额。 */
export interface TokenPrice {
  inputPerMillion: number;
  outputPerMillion: number;
}

export function estimateAiCost(promptTokens: number, completionTokens: number, price: TokenPrice): number | null {
  const inputRate = Number(price.inputPerMillion);
  const outputRate = Number(price.outputPerMillion);
  if (!(inputRate > 0) && !(outputRate > 0)) return null;
  const prompt = Math.max(0, promptTokens);
  const completion = Math.max(0, completionTokens);
  const amount = (prompt / 1_000_000) * Math.max(0, inputRate) + (completion / 1_000_000) * Math.max(0, outputRate);
  return Math.round(amount * 10000) / 10000;
}

export function formatCny(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "¥0";
  if (amount < 0.01) return `¥${amount.toFixed(4)}`;
  if (amount < 1) return `¥${amount.toFixed(3)}`;
  return `¥${amount.toFixed(2)}`;
}
