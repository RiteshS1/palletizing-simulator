import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SimulatorApp } from "@/components/simulator/SimulatorApp";
import { pageMetadata } from "@/lib/seo";
import { SIM_MODES, type SimMode } from "@/lib/simModes";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => SIM_MODES.map((mode) => ({ locale, mode })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/simulator/[mode]">): Promise<Metadata> {
  const { locale, mode } = await params;
  const t = await getTranslations({ locale, namespace: "sim" });
  const tm = await getTranslations({ locale, namespace: "meta" });
  const title = `${t("title")}: ${SIM_MODES.includes(mode as SimMode) ? t(`modes.${mode}`) : ""}`;
  return pageMetadata({ locale, path: `/simulator/${mode}`, title, description: tm("description") });
}

export default async function SimulatorPage({ params }: PageProps<"/[locale]/simulator/[mode]">) {
  const { locale, mode } = await params;
  if (!SIM_MODES.includes(mode as SimMode)) notFound();
  setRequestLocale(locale);
  return (
    <>
      <SiteHeader />
      <main id="main">
        <SimulatorApp mode={mode as SimMode} />
      </main>
    </>
  );
}
