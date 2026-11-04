import { describe, expect, it } from "vitest";
import { assertCompletionWithinWindow, ProviderError, type CompletionRequest } from "@/lib/ai/provider";

function request(
  content: string,
  contextWindow: number,
  maxTokens?: number,
): CompletionRequest {
  return {
    provider: {
      id: "provider",
      name: "test",
      kind: "openai",
      baseUrl: "",
      apiKey: "",
      enabled: true,
      createdAt: "",
      updatedAt: "",
      models: [{ id: "test-model", label: "Test", contextWindow, maxOutputTokens: 200 }],
    },
    model: "test-model",
    messages: [{ role: "user", content }],
    maxTokens,
  };
}

describe("assertCompletionWithinWindow", () => {
  it("allows a prompt when estimated input and output fit", () => {
    expect(() => assertCompletionWithinWindow(request("短提示", 1000, 100))).not.toThrow();
  });

  it("rejects a prompt that cannot fit with its requested output reserve", () => {
    expect(() => assertCompletionWithinWindow(request("内容".repeat(500), 500, 100))).toThrow(
      /超过模型「Test」的 500 token 上下文窗口/,
    );
  });

  it("does not block connection tests based on model-window estimates", () => {
    const probe = request("ping", 1, 8);
    probe.purpose = "connection-test";
    expect(() => assertCompletionWithinWindow(probe)).not.toThrow();
  });

  it("does not claim a hard limit when model window metadata is absent", () => {
    const noWindow = request("很长".repeat(1000), 1000);
    noWindow.provider.models[0].contextWindow = undefined;
    expect(() => assertCompletionWithinWindow(noWindow)).not.toThrow();
  });

  it("reserves the model's declared output limit when the request uses the provider default", () => {
    const req = request("输入", 150, undefined);
    req.provider.models[0].maxOutputTokens = 200;
    expect(() => assertCompletionWithinWindow(req)).toThrow(ProviderError);
  });
});
