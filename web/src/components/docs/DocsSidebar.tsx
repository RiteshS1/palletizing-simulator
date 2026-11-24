"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { DOC_GROUPS, DOCS } from "@/lib/docs";

export function DocsSidebar() {
  const t = useTranslations("docs");
  const pathname = usePathname();
  const active = pathname === "/docs" ? "overview" : pathname.replace(/^\/docs\//, "");

  const list = (
    <nav aria-label={t("title")} className="space-y-6 text-[14px]">
      {DOC_GROUPS.map((g) => (
        <div key={g}>
          <p className="mb-2 font-display text-[12px] font-semibold tracking-wide text-mute">{t(`groups.${g}`)}</p>
          <ul className="space-y-0.5">
            {DOCS.filter((d) => d.group === g).map((d) => {
              const on = d.slug === active;
              return (
                <li key={d.slug}>
                  <Link
                    href={d.slug === "overview" ? "/docs" : `/docs/${d.slug}`}
                    aria-current={on ? "page" : undefined}
                    className={`relative block rounded-xs py-1.5 pl-3 pr-2 transition-colors ${
                      on ? "bg-paper-3 font-medium text-ink before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:bg-signal" : "text-ink-2 hover:bg-paper-2 hover:text-ink"
                    }`}
                  >
                    {t(`pages.${d.slug}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* desktop: sticky column */}
      <div className="hidden lg:block">
        <div className="sticky top-16 h-[calc(100dvh-4rem)] overflow-y-auto py-8 pr-4">{list}</div>
      </div>
      {/* mobile: collapsible drawer */}
      <details className="group border-b border-line lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-sm font-medium">
          {t(`pages.${active}`)}
          <span className="text-mute transition-transform group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="pb-6">{list}</div>
      </details>
    </>
  );
}
