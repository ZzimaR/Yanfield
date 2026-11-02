import {describe,it,expect} from "vitest";
import {reportedUsageCost} from "@/lib/ai/provider";
describe("接口费用识别",()=>{
  it("OpenRouter usage.cost 使用原币种 USD，0 元也算有效返回",()=>{
    expect(reportedUsageCost({cost:0.002},"https://openrouter.ai/api/v1")).toEqual({amount:0.002,currency:"USD"});
    expect(reportedUsageCost({cost:0},"https://openrouter.ai/api/v1")).toEqual({amount:0,currency:"USD"});
  });
  it("兼容接口必须明确给出币种，不猜人民币",()=>{
    expect(reportedUsageCost({cost:2},"http://localhost:4011/v1")).toBeUndefined();
    expect(reportedUsageCost({cost:2,cost_currency:"CNY"},"http://localhost:4011/v1")).toEqual({amount:2,currency:"CNY"});
    expect(reportedUsageCost({cost:2},"https://openrouter.ai.evil.example/v1")).toBeUndefined();
  });
  it("拒绝金额字符串、负数、非有限值和未知币种",()=>{
    for(const cost of ["0.2",-2,Infinity,NaN,null])expect(reportedUsageCost({cost,currency:"USD"},"http://localhost")).toBeUndefined();
    expect(reportedUsageCost({cost:1,currency:"credits"},"http://localhost")).toBeUndefined();
  });
});
