import type { Metadata } from "next";
import { DOC_DESCRIPTIONS } from "@/generated/doc-descriptions";
import { SITE } from "./site";

// One place that builds a page's SEO + link-preview metadata: canonical URL, hreflang alternates,
// Open Graph (Facebook, LinkedIn, Slack, Discord...) and Twitter/X cards, with a per-language image.
export function pageMetadata({ locale, path, title, description, absoluteTitle }: { locale: string; path: string; title: string; description: string; absoluteTitle?: boolean }): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} · ${SITE.name}`;
  const image = { url: `/og/${locale}.jpg`, width: 1200, height: 630, alt: fullTitle };
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { en: `/en${path}`, ja: `/ja${path}`, "x-default": `/en${path}` },
    },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      title: fullTitle,
      description,
      url: `/${locale}${path}`,
      locale: locale === "ja" ? "ja_JP" : "en_US",
      alternateLocale: locale === "ja" ? ["en_US"] : ["ja_JP"],
      images: [image],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [image.url] },
  };
}

// A docs page's description: its first paragraph, extracted at build time by scripts/build-knowledge.ts.
export function docDescription(locale: string, slug: string, fallback: string): string {
  return DOC_DESCRIPTIONS[`${locale}/${slug}`] || fallback;
}
