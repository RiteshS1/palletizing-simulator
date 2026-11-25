"use client";

import { useTranslations } from "next-intl";

// Scrolls through Lenis when the landing page's smooth scrolling is active, natively otherwise.
export function BackToTop() {
  const t = useTranslations("footer");
  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = (window as Window & { __lenis?: { scrollTo: (y: number, o?: object) => void } }).__lenis;
    if (lenis) lenis.scrollTo(0, { duration: reduce ? 0 : 1.4 });
    else window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    document.getElementById("main")?.focus({ preventScroll: true });
  };
  return (
    <button
      type="button"
      onClick={toTop}
      className="group inline-flex items-center gap-2 rounded-xs px-3 py-2 text-sm font-medium text-ink ring-1 ring-ink/15 transition-colors hover:bg-ink hover:text-paper"
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M10 16.5v-12M5.5 9 10 4.5 14.5 9" />
      </svg>
      {t("backToTop")}
    </button>
  );
}
