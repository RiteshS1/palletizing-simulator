import { getTranslations } from "next-intl/server";
import credits from "../../../public/images/credits.json";
import { SITE } from "@/lib/site";
import { Logo } from "./Logo";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tm = await getTranslations("meta");
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 pb-28 pt-10 text-sm text-mute sm:px-8 md:grid-cols-[auto_1fr_auto] md:items-start md:pr-64">
        <Logo className="text-ink" />
        <div className="space-y-1.5">
          <p className="text-ink-2">{t("builtWith")}</p>
          <p>{tm("inspired")}</p>
          <p>
            {t("photos", {
              names: credits.map((c) => c.photographer).join(", "),
            })}{" "}
            {t("assets")}
          </p>
        </div>
        <a href={SITE.repo} className="text-ink underline decoration-signal underline-offset-4" target="_blank" rel="noreferrer">
          {t("source")} ↗
        </a>
      </div>
    </footer>
  );
}
