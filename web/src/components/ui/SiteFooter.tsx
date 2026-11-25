import { getTranslations } from "next-intl/server";
import credits from "../../../public/images/credits.json";
import { SITE } from "@/lib/site";
import { BackToTop } from "./BackToTop";
import { Logo } from "./Logo";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tm = await getTranslations("meta");
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-10 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-8">
          <Logo className="text-ink" />
          <p className="text-[15px] text-ink-2">
            {t.rich("madeWith", {
              name: (chunks) => (
                <a href={SITE.author.url} target="_blank" rel="noopener author" className="font-semibold text-signal-ink underline-offset-4 hover:underline">
                  {chunks}
                </a>
              ),
            })}
          </p>
          <BackToTop />
        </div>
        <div className="grid gap-6 pt-8 text-sm text-mute md:grid-cols-[1fr_auto] md:pr-56">
          <div className="space-y-1.5">
            <p className="text-ink-2">{t("builtWith")}</p>
            <p>{tm("inspired")}</p>
            <p>
              {t("photos", { names: credits.map((c) => c.photographer).join(", ") })} {t("assets")}
            </p>
          </div>
          <a href={SITE.repo} className="self-start text-ink underline decoration-signal underline-offset-4" target="_blank" rel="noreferrer">
            {t("source")} ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
