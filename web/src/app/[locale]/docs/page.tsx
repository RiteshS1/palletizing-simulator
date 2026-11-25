import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocPage } from "@/components/docs/DocPage";
import { docDescription, pageMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/docs">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "docs" });
  const tm = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, path: "/docs", title: t("pages.overview"), description: docDescription(locale, "overview", tm("description")) });
}

export default async function DocsHome({ params }: PageProps<"/[locale]/docs">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DocPage locale={locale} slug="overview" />;
}
