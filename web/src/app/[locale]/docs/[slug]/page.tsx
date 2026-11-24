import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocPage } from "@/components/docs/DocPage";
import { routing } from "@/i18n/routing";
import { DOCS } from "@/lib/docs";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => DOCS.filter((d) => d.slug !== "overview").map((d) => ({ locale, slug: d.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/docs/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "docs" });
  return {
    title: t.has(`pages.${slug}`) ? t(`pages.${slug}`) : undefined,
    alternates: { languages: { en: `/en/docs/${slug}`, ja: `/ja/docs/${slug}` } },
  };
}

export default async function DocSlugPage({ params }: PageProps<"/[locale]/docs/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <DocPage locale={locale} slug={slug} />;
}
