import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/landing/Hero";
import { CompareSection, FinalSection, InspiredSection, LearnSection, OrdersSection, RealWorldSection, RulesSection, StackSection } from "@/components/landing/Sections";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, path: "", title: t("title"), description: t("description"), absoluteTitle: true });
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("meta");
  // Structured data so search engines understand what the site is.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: `${SITE.url}/${locale}`,
    inLanguage: locale,
    description: t("description"),
    author: { "@type": "Person", name: SITE.author.name, url: SITE.author.url },
    about: ["Robotics", "C++", "Palletizing", "ROS 2", "Algorithms"],
  };
  return (
    <SmoothScroll>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <SiteHeader variant="overlay" />
      <main id="main">
        <Hero />
        <RulesSection />
        <CompareSection />
        <OrdersSection />
        <RealWorldSection />
        <StackSection />
        <LearnSection />
        <InspiredSection />
        <FinalSection />
      </main>
      <SiteFooter />
    </SmoothScroll>
  );
}
