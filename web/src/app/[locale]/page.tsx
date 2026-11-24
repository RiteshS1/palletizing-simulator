import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/landing/Hero";
import { CompareSection, FinalSection, InspiredSection, LearnSection, OrdersSection, RealWorldSection, RulesSection, StackSection } from "@/components/landing/Sections";
import { SmoothScroll } from "@/components/landing/SmoothScroll";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { SiteHeader } from "@/components/ui/SiteHeader";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <SmoothScroll>
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
