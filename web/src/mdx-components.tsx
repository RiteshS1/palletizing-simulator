import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";

// Extra building blocks available inside every docs .mdx file.
function Callout({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <aside className="my-6 border-l-[3px] border-signal bg-peach-soft/60 px-4 py-3 text-[0.97rem] text-ink-2">
      {title && <p className="mb-1 font-semibold text-ink">{title}</p>}
      <div className="[&>p:last-child]:mb-0">{children}</div>
    </aside>
  );
}

function Interview({ children }: { children: ReactNode }) {
  return (
    <aside className="my-6 rounded-xs bg-ink px-5 py-4 text-[0.97rem] leading-relaxed text-paper/90 [&_strong]:text-paper">
      <p className="mb-1 font-display text-sm font-semibold tracking-wide text-peach">Interview angle</p>
      <div className="[&>p:last-child]:mb-0">{children}</div>
    </aside>
  );
}

function InterviewJa({ children }: { children: ReactNode }) {
  return (
    <aside className="my-6 rounded-xs bg-ink px-5 py-4 text-[0.97rem] leading-relaxed text-paper/90 [&_strong]:text-paper">
      <p className="mb-1 font-display text-sm font-semibold text-peach">面接での説明ポイント</p>
      <div className="[&>p:last-child]:mb-0">{children}</div>
    </aside>
  );
}

const components: MDXComponents = { Callout, Interview, InterviewJa };

export function useMDXComponents(): MDXComponents {
  return components;
}
