import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocPage } from "@/components/docs/DocPage";

export async function generateMetadata({ params }: PageProps<"/[locale]/docs">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "docs" });
  return { title: t("pages.overview"), alternates: { languages: { en: "/en/docs", ja: "/ja/docs" } } };
}

export default async function DocsHome({ params }: PageProps<"/[locale]/docs">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DocPage locale={locale} slug="overview" />;
}
