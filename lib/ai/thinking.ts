import type {AppSettings,ProviderConfig} from "@/lib/types";
export type ThinkingLevel="off"|"low"|"high"|"max";
export const THINKING_OPTIONS=[{value:"off",label:"关闭"},{value:"low",label:"轻量"},{value:"high",label:"深入"},{value:"max",label:"尽力"}] as const;
export const thinkingKey=(providerId:string,model:string)=>`${providerId}:${model}`;
export function supportsThinking(provider:{kind:string},model:string):boolean{return provider.kind==="openai"&&/^deepseek-(?:flash|v4-pro)$/i.test(model);}
export function modelThinking(settings:Pick<AppSettings,"modelThinking">,provider:Pick<ProviderConfig,"id"|"kind">,model:string):ThinkingLevel|undefined {
 return supportsThinking(provider,model)?settings.modelThinking?.[thinkingKey(provider.id,model)]??"off":undefined;
}
