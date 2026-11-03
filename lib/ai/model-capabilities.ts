import type { ModelOption, ModelThinkingCapability, ThinkingEffort } from "@/lib/types";
import { THINKING_EFFORTS } from "./thinking";
const object = (value:unknown):Record<string,unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
const positive = (value:unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
const efforts = (value:unknown):ThinkingEffort[] | undefined => Array.isArray(value) ? [...new Set(value.filter((v):v is ThinkingEffort => typeof v === "string" && THINKING_EFFORTS.includes(v as ThinkingEffort)))] : undefined;
const effort = (value:unknown) => typeof value === "string" && THINKING_EFFORTS.includes(value as ThinkingEffort) ? value as ThinkingEffort : undefined;
/** Normalize documented discovery fields, preserving unknown versus explicitly unsupported. */
export function discoverModelCapabilities(raw:unknown, kind:string):Partial<ModelOption> {
  const row=object(raw), result:Partial<ModelOption>={};
  const context=positive(row.context_window) ?? positive(row.context_length) ?? positive(row.max_input_tokens) ?? positive(row.inputTokenLimit);
  const output=positive(row.max_output_tokens) ?? positive(row.max_tokens) ?? positive(row.outputTokenLimit) ?? positive(object(row.top_provider).max_completion_tokens);
  if(context)result.contextWindow=context;
  if(output)result.maxOutputTokens=output;
  if(Array.isArray(row.supported_parameters))result.supportedParameters=row.supported_parameters.filter((v):v is string=>typeof v === "string" && v.length<128).slice(0,100);
  let thinking:ModelThinkingCapability|undefined;
  if(kind === "anthropic") {
    const caps=object(row.capabilities), think=object(caps.thinking), control=object(caps.effort);
    const levels=THINKING_EFFORTS.filter(level=>object(control[level]).supported===true);
    if(typeof think.supported === "boolean" || typeof control.supported === "boolean") {
      thinking={supported:think.supported===true || control.supported===true,format:"anthropic", levels};
      const disabled=object(object(think.types).disabled).supported;
      if(typeof disabled === "boolean")thinking.canDisable=disabled;
    }
  } else if(kind === "gemini" && typeof row.thinking === "boolean") {
    thinking={supported:row.thinking};
  } else if(kind === "openai") {
    const control=object(row.effort), reasoning=object(row.reasoning);
    if(Array.isArray(control.supported_levels)) {
      thinking={supported:true,format:"deepseek",levels:efforts(control.supported_levels),defaultLevel:effort(control.default_level)};
      // Mode toggle is a documented DeepSeek protocol property; applied only at the official endpoint.
      thinking.canDisable=true;
    } else if(Array.isArray(reasoning.supported_efforts)) {
      thinking={supported:true,format:"openrouter",levels:efforts(reasoning.supported_efforts),defaultLevel:effort(reasoning.default_effort)};
      if(typeof reasoning.mandatory === "boolean")thinking.canDisable=!reasoning.mandatory;
    } else if(result.supportedParameters?.includes("reasoning")) {
      thinking={supported:true};
    }
  }
  if(thinking)result.thinking=thinking;
  return result;
}
