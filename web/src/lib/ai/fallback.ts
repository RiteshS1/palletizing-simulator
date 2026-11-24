// Failover between language models: try Groq first, fall back to Gemini.
//
// A wrapper that is itself a LanguageModelV4, so streamText() doesn't know it exists. For each
// request it walks the list: if a provider throws (429 rate limit, 5xx, network), times out, or
// its stream starts with an error before any content arrives, the SAME request goes to the next.
// Once content has started flowing we stay with that provider (switching mid-answer would garble it).
import type { LanguageModelV4, LanguageModelV4StreamPart } from "@ai-sdk/provider";

export interface FallbackOptions {
  /** How long a provider may take to produce its first content before we give up on it. */
  firstChunkTimeoutMs?: number;
  onSelect?: (model: LanguageModelV4) => void;
  onFailure?: (model: LanguageModelV4, error: unknown) => void;
}

const META: LanguageModelV4StreamPart["type"][] = ["stream-start", "response-metadata", "raw"];

function withTimeout<T>(p: PromiseLike<T>, ms: number, what: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
    Promise.resolve(p).then(
      (v) => (clearTimeout(id), resolve(v)),
      (e) => (clearTimeout(id), reject(e)),
    );
  });
}

export function withFallback(models: LanguageModelV4[], opts: FallbackOptions = {}): LanguageModelV4 {
  if (models.length === 0) throw new Error("withFallback needs at least one model");
  const timeout = opts.firstChunkTimeoutMs ?? 15_000;

  return {
    specificationVersion: "v4",
    provider: "fallback",
    modelId: models.map((m) => `${m.provider}:${m.modelId}`).join(" > "),
    supportedUrls: models[0].supportedUrls,

    async doGenerate(options) {
      let last: unknown;
      for (const m of models) {
        try {
          const result = await withTimeout(m.doGenerate(options), timeout * 4, m.modelId);
          opts.onSelect?.(m);
          return result;
        } catch (e) {
          last = e;
          opts.onFailure?.(m, e);
        }
      }
      throw last;
    },

    async doStream(options) {
      let last: unknown;
      for (const m of models) {
        try {
          const result = await withTimeout(m.doStream(options), timeout, m.modelId);
          const reader = result.stream.getReader();
          // Peek until the first real content (or an error) to decide whether this provider works.
          const buffered: LanguageModelV4StreamPart[] = [];
          let done = false;
          for (;;) {
            const r = await withTimeout(reader.read(), timeout, `${m.modelId} first chunk`);
            if (r.done) {
              done = true;
              break;
            }
            if (r.value.type === "error") throw r.value.error;
            buffered.push(r.value);
            if (!META.includes(r.value.type)) break;
          }
          opts.onSelect?.(m);
          const stream = new ReadableStream<LanguageModelV4StreamPart>({
            start(controller) {
              for (const part of buffered) controller.enqueue(part);
              if (done) controller.close();
            },
            async pull(controller) {
              const { done: d, value } = await reader.read();
              if (d) controller.close();
              else controller.enqueue(value);
            },
            cancel(reason) {
              return reader.cancel(reason);
            },
          });
          return { ...result, stream };
        } catch (e) {
          last = e;
          opts.onFailure?.(m, e);
        }
      }
      throw last;
    },
  };
}
