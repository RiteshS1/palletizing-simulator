import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { routing } from "@/i18n/routing";
import { archivo, geist, geistMono, notoJp } from "@/lib/fonts";
import { SITE } from "@/lib/site";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE.url),
    title: { default: t("title"), template: `%s · ${SITE.name}` },
    description: t("description"),
    alternates: { languages: { en: "/en", ja: "/ja", "x-default": "/en" } },
    openGraph: { title: t("title"), description: t("description"), siteName: SITE.name, locale, type: "website" },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description") },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale); // lets every page under this layout render statically
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${archivo.variable} ${geist.variable} ${geistMono.variable} ${notoJp.variable}`}>
      <body className="min-h-dvh bg-paper text-ink">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <ChatWidget />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
