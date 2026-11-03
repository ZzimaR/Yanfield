import { extractJson } from "@/lib/ai/prompts";

/** Normalize the observed DeepSeek tool envelope; the caller still validates every tool and argument. */
export function parseAgentDecision(raw: string): unknown {
  const json=extractJson(raw);
  if(json!==null && (!raw.includes("DSML") || (typeof json==="object" && "calls" in json)))return json;
  const marker="｜{1,2}DSML｜{1,2}";
  const envelope=new RegExp(`^([\\s\\S]*?)<${marker} calls>([\\s\\S]*?)<\\/${marker} calls>\\s*$`).exec(raw);
  if(!envelope)return null;
  const invoke=new RegExp(`<${marker} invoke name="([^"<>]+)">([\\s\\S]*?)<\\/${marker} invoke>`,"g");
  const parameter=new RegExp(`^\\s*<${marker} parameter name="args" string="false">([\\s\\S]*?)<\\/${marker} parameter>\\s*$`);
  const calls: {name:string;args:unknown}[]=[];
  let cursor=0;
  for(const match of envelope[2].matchAll(invoke)) {
    if(envelope[2].slice(cursor,match.index).trim())return null;
    const args=parameter.exec(match[2]);
    if(!args)return null;
    try {calls.push({name:match[1],args:JSON.parse(args[1])});}catch{return null;}
    cursor=(match.index??0)+match[0].length;
  }
  if(!calls.length||envelope[2].slice(cursor).trim())return null;
  return {message:envelope[1].trim(),calls,done:false};
}

/** JSON mode is opt-in for known compatible model endpoints, not all OpenAI-like gateways. */
export function supportsDecisionJson(provider: {kind:string;baseUrl:string}, model:string): boolean {
  if(provider.kind!=="openai")return false;
  if(/^deepseek-/i.test(model))return true;
  try{return ["api.deepseek.com","api.openai.com"].includes(new URL(provider.baseUrl).hostname);}catch{return false;}
}

const str={type:"string"};
const kind={type:"string",enum:["chapter","blueprint","character","world","foreshadow","outline","volume-outline"]};
const tool=(name:string,description:string,properties:Record<string,unknown>,required:string[]=[])=>({name,description,parameters:{type:"object",properties,required,additionalProperties:false}});
export const DECISION_TOOLS=[
  tool("workspace","读取作品基本信息、卷章和资料目录",{}),
  tool("list","分页查找资料目录",{kind,query:str,offset:{type:"integer"},limit:{type:"integer"}},["kind"]),
  tool("read","读取指定对象，优先读取候选",{kind,id:str,offset:{type:"integer"},limit:{type:"integer"}},["kind","id"]),
  tool("propose","暂存资料新建或字段修改，等待作者确认",{kind,id:str,fields:{type:"object",additionalProperties:true},reason:str,title:str},["kind","fields","reason"]),
  tool("write_chapter","调用写手生成正文候选，不能直接落库",{id:str,title:str,volumeId:{type:["string","null"]},instruction:str,words:{type:"integer"},mode:{type:"string",enum:["rewrite","append","selection"]}},["instruction"]),
  tool("reject_change","丢弃本轮候选",{changeId:str},["changeId"]),
  tool("read_archive","读取章节档案",{chapterId:str},["chapterId"]),
  tool("respond","任务完成、普通讨论或需要作者确认时，向作者答复",{message:str},["message"])
];
export function nativeDecisionSystem(system:string):string {
  return system.replace(/^每轮最多12个工具调用[^\n]+/m,"通过声明的原生函数推进任务，不在回复里书写JSON或DSML/XML工具标签。每轮最多12个调用。完成、普通讨论或需要作者确认时调用respond；其他工具结果返回后继续执行。");
}
export function usesDecisionTool(provider:{kind:string;baseUrl:string},model:string):boolean {
  if(provider.kind!=="openai")return false;
  if(/^deepseek-/i.test(model))return true;
  try{return new URL(provider.baseUrl).hostname==="api.deepseek.com";}catch{return false;}
}
