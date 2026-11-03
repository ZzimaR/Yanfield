import {describe,it,expect,vi,afterEach} from "vitest";
import {getProviderBalance} from "@/lib/ai/balance";
import type {ProviderConfig} from "@/lib/types";
const provider={baseUrl:"https://api.deepseek.com/v1",apiKey:"fake-test-key"} as ProviderConfig;
afterEach(()=>vi.unstubAllGlobals());
describe("余额查询",()=>{
  it("只调用官方余额接口，原样保留币种与精度且不返回密钥",async()=>{
    const fetcher=vi.fn(async(_url:string,_init?:RequestInit)=>new Response(JSON.stringify({is_available:true,balance_infos:[{currency:"CNY",total_balance:"26.17",granted_balance:"0.00",topped_up_balance:"26.17"}]})));vi.stubGlobal("fetch",fetcher);
    const value=await getProviderBalance(provider);
    expect(value.balances[0]).toEqual({currency:"CNY",total:"26.17",granted:"0.00",toppedUp:"26.17"});
    expect(JSON.stringify(value)).not.toContain("fake-test-key");
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.deepseek.com/user/balance");
  });
  it("鉴权失败不回显服务端可能包含密钥的消息",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>new Response("fake-test-key",{status:401})));
    await expect(getProviderBalance(provider)).rejects.toThrow("余额查询鉴权失败");
  });
  it("中转服务不被当作官方服务查询",async()=>{
    const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    await expect(getProviderBalance({...provider,baseUrl:"https://example.test"})).rejects.toThrow("暂未接入");expect(fetcher).not.toHaveBeenCalled();
  });
});
