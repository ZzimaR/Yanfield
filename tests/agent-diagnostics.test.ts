import {describe,it,expect} from "vitest";
import {protocolDiagnostic,redactDiagnostic} from "@/lib/ai/agent/diagnostics";
describe("诊断脱敏与边界",()=>{
  it("脱敏常见密钥字段与 Bearer，不收集请求上下文",()=>{
    const raw='{"apiKey":"secretValue","authorization":"Bearer secretToken","content":"sk-testSecretKey123"}';
    const safe=redactDiagnostic(raw);expect(safe).not.toContain("secretValue");expect(safe).not.toContain("secretToken");expect(safe).not.toContain("sk-testSecretKey123");
  });
  it("超长返回仅保留有界的首尾片段",()=>{
    const value=protocolDiagnostic("a".repeat(20000),null,[],2,1);
    expect(value.responseChars).toBe(20000);expect(value.responsePreview).toHaveLength(4000);expect(value.responseTail).toHaveLength(1000);
  });
});
