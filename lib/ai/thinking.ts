import type { AppSettings, ModelOption, ProviderConfig, ThinkingEffort } from "@/lib/types";

export const THINKING_EFFORTS = ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"] as const;
export type ThinkingLevel = "default" | "off" | ThinkingEffort;
export const THINKING_OPTIONS: {value: ThinkingLevel; label: string}[] = [
  {value:"default",label:"默认"}, {value:"off",label:"关闭"}, {value:"minimal",label:"极简"},
  {value:"low",label:"轻量"}, {value:"medium",label:"标准"}, {value:"high",label:"深入"},
  {value:"xhigh",label:"更深入"}, {value:"max",label:"尽力"}, {value:"ultra",label:"极致"},
];
export const thinkingKey = (providerId: string, model: string) => `${providerId}:${model}`;
type ThinkingProvider = {kind: string; baseUrl?: string; models?: ModelOption[]};
function host(provider: ThinkingProvider) {
  try { return new URL(provider.baseUrl || "").hostname; } catch { return ""; }
}
/** Missing metadata stays unknown. Legacy fallback is confined to the official endpoint. */
export function thinkingProfile(provider: ThinkingProvider, model: string) {
  const declared = provider.models?.find(item => item.id === model)?.thinking;
  const officialDeepSeek = provider.kind === "openai" && host(provider) === "api.deepseek.com";
  const capability = declared ?? (officialDeepSeek && /^deepseek-(?:flash|v4-pro)$/i.test(model)
    ? {supported:true, levels:["low","high","max"] as ThinkingEffort[], canDisable:true, format:"deepseek" as const} : undefined);
  const adapter = capability?.supported ?
    provider.kind === "anthropic" && capability.format === "anthropic" ? "anthropic" :
    officialDeepSeek && capability.format === "deepseek" ? "deepseek" :
    provider.kind === "openai" && host(provider) === "openrouter.ai" && capability.format === "openrouter" ? "openrouter" : undefined
    : undefined;
  const levels = Array.isArray(capability?.levels) ? capability.levels.filter(level => THINKING_EFFORTS.includes(level)) : [];
  const values: ThinkingLevel[] = ["default", ...(adapter && capability?.canDisable ? ["off" as const] : []), ...(adapter ? levels : [])];
  return {capability, adapter, options: THINKING_OPTIONS.filter(option => values.includes(option.value))};
}
export function supportsThinking(provider: ThinkingProvider, model: string): boolean {
  return thinkingProfile(provider, model).options.length > 1;
}
export function modelThinking(settings: Pick<AppSettings,"modelThinking">, provider: ThinkingProvider & {id:string}, model:string): ThinkingLevel | undefined {
  const profile = thinkingProfile(provider, model);
  if (!profile.adapter) return undefined;
  const stored = settings.modelThinking?.[thinkingKey(provider.id, model)];
  return stored && profile.options.some(option => option.value === stored) ? stored : "default";
}
/** Only an explicit supported setting emits parameters; default never forces an API default. */
export function thinkingParameters(provider: ThinkingProvider, model: string, level?: ThinkingLevel): Record<string, unknown> {
  const profile = thinkingProfile(provider, model);
  if (!level || level === "default" || !profile.options.some(option => option.value === level)) return {};
  switch (profile.adapter) {
    case "deepseek": return {thinking:{type:level === "off" ? "disabled" : "enabled"}, ...(level !== "off" ? {reasoning_effort:level} : {})};
    case "anthropic": return level === "off" ? {thinking:{type:"disabled"}} : {output_config:{effort:level}};
    case "openrouter": return {reasoning:level === "off" ? {enabled:false} : {effort:level}};
    default: return {};
  }
}
