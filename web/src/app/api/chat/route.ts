// POST /api/chat: the assistant. Retrieval (BM25 over docs + code) -> Groq, failing over to Gemini
// -> streamed back as UI messages. Keys stay on the server.
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream, type UIMessage } from "ai";
import { checkBotId } from "botid/server";
import knowledge from "@/generated/knowledge";
import { search } from "@/lib/ai/bm25";
import { withFallback } from "@/lib/ai/fallback";
import { buildInstructions } from "@/lib/ai/prompt";
import { rateLimit } from "@/lib/ai/rateLimit";

export const maxDuration = 60;

const GROQ_MODEL = "openai/gpt-oss-120b";
// Pinned Gemini model first; the "-latest" alias as a last resort survives model retirements.
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
const MAX_MESSAGES = 16;
const MAX_CHARS = 1500;

function textOf(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ");
}

function json(status: number, body: object, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

// BotID verifies its invisible browser challenge with Vercel's infrastructure, so it only runs
// when deployed there. If the check itself breaks, we keep serving and rely on the rate limiter.
async function isBot(): Promise<boolean> {
  if (!process.env.VERCEL) return false;
  try {
    return (await checkBotId()).isBot;
  } catch (e) {
    console.warn("[chat] BotID check failed", e instanceof Error ? e.message : e);
    return false;
  }
}

export async function POST(req: Request) {
  if (await isBot()) return json(403, { error: "forbidden" });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = rateLimit(ip, { perMinute: 8, perHour: 60 });
  if (!limit.ok) return json(429, { error: "rate_limited" }, { "retry-after": String(limit.retryAfter) });

  let body: { messages?: UIMessage[]; locale?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_json" });
  }
  const messages = (body.messages ?? []).slice(-MAX_MESSAGES);
  const locale = body.locale === "ja" ? "ja" : "en";
  const last = messages.at(-1);
  if (!last || last.role !== "user" || !textOf(last).trim()) return json(400, { error: "no_question" });
  if (messages.some((m) => textOf(m).length > MAX_CHARS * 4) || textOf(last).length > MAX_CHARS) return json(413, { error: "too_long" });

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const models = [
    ...(groqKey ? [createGroq({ apiKey: groqKey })(GROQ_MODEL)] : []),
    ...(geminiKey ? GEMINI_MODELS.map((id) => createGoogleGenerativeAI({ apiKey: geminiKey })(id)) : []),
  ];
  if (models.length === 0) return json(503, { error: "no_ai_keys" });

  // Retrieve with the last two user turns, so follow-ups like "and in C++?" keep their context.
  const query = messages
    .filter((m) => m.role === "user")
    .slice(-2)
    .map(textOf)
    .join(" ");
  const hits = search(knowledge, query, 6, { locale });
  const sources = hits
    .filter((h) => h.chunk.url)
    .reduce<{ title: string; url: string }[]>((acc, h) => {
      const title = h.chunk.title.split(" — ")[0];
      if (!acc.some((s) => s.url === h.chunk.url)) acc.push({ title, url: h.chunk.url! });
      return acc;
    }, [])
    .slice(0, 3);

  const stream = createUIMessageStream({
    async execute({ writer }) {
      writer.write({ type: "data-sources", data: sources });
      const model = withFallback(models, {
        firstChunkTimeoutMs: 15_000,
        onSelect: (m) => writer.write({ type: "data-provider", data: { provider: m.provider } }),
        onFailure: (m, e) => console.warn(`[chat] ${m.provider}:${m.modelId} failed, trying next`, e instanceof Error ? e.message : e),
      });
      const result = streamText({
        model,
        instructions: buildInstructions(locale, hits),
        messages: await convertToModelMessages(messages),
        maxOutputTokens: 900,
        temperature: 0.3,
        // The fallback chain IS the retry strategy: one call per model, no hidden retries that
        // would burn free-tier quotas (e.g. Gemini's 5 requests/minute).
        maxRetries: 0,
      });
      writer.merge(toUIMessageStream({ stream: result.stream, sendStart: true }));
    },
    onError: () => "The assistant is unavailable right now.",
  });
  return createUIMessageStreamResponse({ stream });
}
