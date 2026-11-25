import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SITE } from "@/lib/site";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";

export async function SiteHeader({ variant = "solid" }: { variant?: "solid" | "overlay" }) {
  const t = await getTranslations("nav");
  return (
    <header
      className={`${variant === "overlay" ? "absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-paper via-paper/80 to-paper/0 pb-4" : "sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md"}`}
    >
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:bg-ink focus:px-3 focus:py-2 focus:text-paper">
        {t("skip")}
      </a>
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8">
        <Link href="/" aria-label={t("home")} className="text-ink">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm sm:gap-2">
          <Link href="/docs" className="rounded-xs px-2.5 py-1.5 text-ink-2 hover:text-ink">
            {t("docs")}
          </Link>
          <Link href="/simulator/extreme-points" className="rounded-xs px-2.5 py-1.5 text-ink-2 hover:text-ink">
            {t("simulator")}
          </Link>
          <a href={SITE.repo} className="hidden rounded-xs px-2.5 py-1.5 text-ink-2 hover:text-ink sm:inline" rel="noreferrer" target="_blank">
            GitHub
          </a>
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
