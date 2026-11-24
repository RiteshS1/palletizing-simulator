"use client";

// Floating assistant: a launcher in the bottom-right corner that opens a streaming chat panel.
// It answers in the page's language and links the doc pages its answer drew on.
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Source = { title: string; url: string };

function sourcesOf(m: UIMessage): Source[] {
  for (const p of m.parts) if (p.type === "data-sources") return (p as { data: Source[] }).data;
  return [];
}
function textOf(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

export function ChatWidget() {
  const t = useTranslations("chat");
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", body: { locale } }), [locale]);
  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";
  const suggestions = t.raw("suggestions") as string[];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, status, reduce]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    sendMessage({ text: q });
    setInput("");
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };
  const rateLimited = error?.message?.includes("rate_limited") || error?.message?.includes("429");

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6" data-testid="chat-widget">
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-label={t("title")}
            initial={reduce ? false : { opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            style={{ transformOrigin: "bottom right" }}
            className="absolute bottom-[72px] right-0 flex h-[min(620px,calc(100dvh-110px))] w-[min(410px,calc(100vw-32px))] flex-col overflow-hidden rounded-xs bg-paper shadow-[0_24px_60px_-12px_rgba(20,20,20,0.35)] ring-1 ring-ink/10"
          >
            <header className="flex items-start justify-between gap-3 bg-ink px-4 py-3.5 text-paper">
              <div>
                <p className="flex items-center gap-2 font-display text-[15px] font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60 motion-reduce:hidden" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
                  </span>
                  {t("title")}
                </p>
                <p className="mt-0.5 text-[12.5px] text-paper/70">{t("subtitle")}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="rounded-xs p-1 text-paper/70 hover:bg-white/10 hover:text-paper">
                <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
                  <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-[14px] leading-relaxed" aria-live="polite">
              {messages.length === 0 && (
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="block w-full rounded-xs border border-line px-3 py-2 text-left text-ink-2 transition-colors hover:border-signal hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="ml-8 rounded-xs bg-ink px-3 py-2 text-paper">
                    {textOf(m)}
                  </div>
                ) : (
                  <div key={m.id} className="mr-2" data-testid="assistant-message">
                    <div className="chat-md text-ink-2">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: ({ href, children }) => (
                            <a href={href} className="text-ink underline decoration-signal underline-offset-2" target={href?.startsWith("/") ? undefined : "_blank"} rel="noreferrer">
                              {children}
                            </a>
                          ),
                          code: ({ children }) => <code className="rounded-[2px] bg-paper-3 px-1 py-0.5 font-mono text-[12.5px] text-ink">{children}</code>,
                          pre: ({ children }) => <pre className="my-2 overflow-x-auto rounded-xs bg-night p-3 text-[12px] text-paper [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-paper">{children}</pre>,
                          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
                          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
                          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
                          table: ({ children }) => <table className="my-2 w-full text-[12.5px]">{children}</table>,
                          th: ({ children }) => <th className="border-b border-line py-1 pr-2 text-left">{children}</th>,
                          td: ({ children }) => <td className="border-b border-line/60 py-1 pr-2">{children}</td>,
                        }}
                      >
                        {textOf(m)}
                      </ReactMarkdown>
                    </div>
                    {sourcesOf(m).length > 0 && textOf(m) && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px]">
                        <span className="text-mute">{t("sources")}:</span>
                        {sourcesOf(m).map((s) => (
                          <a key={s.url} href={s.url} className="rounded-xs bg-peach-soft px-2 py-0.5 text-ink hover:bg-peach">
                            {s.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}
              {status === "submitted" && <p className="text-mute">{t("thinking")}</p>}
              {error && <p className="rounded-xs bg-peach-soft px-3 py-2 text-ink-2">{rateLimited ? t("rateLimited") : t("error")}</p>}
            </div>

            <form onSubmit={onSubmit} className="border-t border-line bg-paper p-3">
              <div className="flex items-end gap-2">
                <label className="sr-only" htmlFor="chat-input">
                  {t("placeholder")}
                </label>
                <textarea
                  id="chat-input"
                  ref={inputRef}
                  rows={1}
                  maxLength={1500}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      ask(input);
                    }
                  }}
                  placeholder={t("placeholder")}
                  className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xs border border-line bg-white px-3 py-2.5 text-[14px] text-ink outline-none focus:border-ink/40"
                />
                {busy ? (
                  <button type="button" onClick={() => stop()} className="h-[42px] rounded-xs border border-ink px-3 text-sm font-medium">
                    {t("stop")}
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim()} className="h-[42px] rounded-xs bg-signal px-3.5 text-sm font-medium text-ink transition-colors hover:bg-[#ff6f3c] disabled:bg-paper-3 disabled:text-mute">
                    {t("send")}
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-mute">{t("disclaimer")}</p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? t("close") : t("open")}
        whileHover={reduce ? undefined : { scale: 1.05 }}
        whileTap={reduce ? undefined : { scale: 0.95 }}
        className="group relative flex h-14 items-center gap-2.5 rounded-full bg-ink pl-4 pr-5 text-paper shadow-[0_12px_30px_-8px_rgba(20,20,20,0.5)]"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-signal">
          {open ? (
            <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
              <path d="M5 5l10 10M15 5 5 15" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 20 20" className="h-4 w-4 fill-white" aria-hidden>
              <rect x="3" y="11" width="6" height="5" />
              <rect x="10" y="11" width="7" height="5" opacity="0.7" />
              <rect x="6" y="4" width="7" height="6" />
            </svg>
          )}
        </span>
        <span className="hidden text-sm font-medium sm:inline">{t("open")}</span>
      </motion.button>
    </div>
  );
}
