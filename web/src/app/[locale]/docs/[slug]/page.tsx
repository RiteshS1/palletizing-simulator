import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DocPage } from "@/components/docs/DocPage";
import { routing } from "@/i18n/routing";
import { DOCS } from "@/lib/docs";
import { docDescription, pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => DOCS.filter((d) => d.slug !== "overview").map((d) => ({ locale, slug: d.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/docs/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "docs" });
  const tm = await getTranslations({ locale, namespace: "meta" });
  const title = t.has(`pages.${slug}`) ? t(`pages.${slug}`) : t("title");
  return pageMetadata({ locale, path: `/docs/${slug}`, title, description: docDescription(locale, slug, tm("description")) });
}

export default async function DocSlugPage({ params }: PageProps<"/[locale]/docs/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <DocPage locale={locale} slug={slug} />;
}
