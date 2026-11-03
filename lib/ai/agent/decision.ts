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
