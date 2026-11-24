"use client";

import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const LABELS: Record<Locale, string> = { en: "EN", ja: "日本語" };

// Switching locale keeps you on the same page; next-intl stores the choice in the NEXT_LOCALE cookie,
// which then wins over the browser's Accept-Language on later visits.
export function LanguageSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const t = useTranslations("nav");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={`flex items-center rounded-xs border text-xs font-medium ${tone === "dark" ? "border-white/25" : "border-ink/15"} ${pending ? "opacity-60" : ""}`}
    >
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          onClick={() =>
            startTransition(() => {
              // @ts-expect-error -- params of the current route are passed through unchanged
              router.replace({ pathname, params }, { locale: l, scroll: false });
            })
          }
          className={`px-2.5 py-1.5 transition-colors ${
            l === locale
              ? tone === "dark"
                ? "bg-white text-ink"
                : "bg-ink text-paper"
              : tone === "dark"
                ? "text-white/80 hover:text-white"
                : "text-ink-2 hover:text-ink"
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
