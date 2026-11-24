import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { generateText, simulateReadableStream, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { withFallback } from "@/lib/ai/fallback";

const usage = { inputTokens: { total: 3, noCache: 3, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 2, text: 2, reasoning: 0 } };

function streamingModel(provider: string, text: string) {
  return new MockLanguageModelV4({
    provider,
    modelId: `${provider}-model`,
    doStream: async () => ({
      stream: simulateReadableStream<LanguageModelV4StreamPart>({
        chunks: [
          { type: "stream-start", warnings: [] },
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: text },
          { type: "text-end", id: "t" },
          { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage } as LanguageModelV4StreamPart,
        ],
      }),
    }),
  });
}

function failingModel(provider: string, how: "throw" | "error-part") {
  return new MockLanguageModelV4({
    provider,
    modelId: `${provider}-model`,
    doStream: async () => {
      if (how === "throw") throw Object.assign(new Error("429 rate limited"), { statusCode: 429 });
      return { stream: simulateReadableStream<LanguageModelV4StreamPart>({ chunks: [{ type: "stream-start", warnings: [] }, { type: "error", error: new Error("upstream 503") }] }) };
    },
    doGenerate: async () => {
      throw new Error("500");
    },
  });
}

describe("withFallback", () => {
  it("uses the first provider when it works", async () => {
    const selected: string[] = [];
    const model = withFallback([streamingModel("groq", "from groq"), streamingModel("google", "from gemini")], { onSelect: (m) => selected.push(m.provider) });
    const result = streamText({ model, prompt: "hi" });
    expect(await result.text).toBe("from groq");
    expect(selected).toEqual(["groq"]);
  });

  it("falls back to Gemini when Groq throws (e.g. 429)", async () => {
    const failed: string[] = [];
    const model = withFallback([failingModel("groq", "throw"), streamingModel("google", "from gemini")], { onFailure: (m) => failed.push(m.provider) });
    const result = streamText({ model, prompt: "hi" });
    expect(await result.text).toBe("from gemini");
    expect(failed).toEqual(["groq"]);
  });

  it("falls back when the stream starts with an error part", async () => {
    const model = withFallback([failingModel("groq", "error-part"), streamingModel("google", "from gemini")]);
    expect(await streamText({ model, prompt: "hi" }).text).toBe("from gemini");
  });

  it("surfaces the last error when every provider fails", async () => {
    const model = withFallback([failingModel("groq", "throw"), failingModel("google", "throw")]);
    await expect(generateText({ model, prompt: "hi", maxRetries: 0 })).rejects.toThrow();
  });
});
