import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SiteHeader } from "@/components/ui/SiteHeader";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1440px] px-4 py-32 sm:px-8">
        <h1 className="max-w-[20ch] font-display text-5xl font-semibold leading-tight tracking-tight">{t("title")}</h1>
        <p className="mt-4 text-lg text-ink-2">{t("body")}</p>
        <Link href="/docs" className="mt-8 inline-block rounded-xs bg-signal px-5 py-3 font-medium text-ink">
          {t("cta")}
        </Link>
      </main>
    </>
  );
}
