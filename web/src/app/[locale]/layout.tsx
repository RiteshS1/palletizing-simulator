import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { routing } from "@/i18n/routing";
import { archivo, geist, geistMono, notoJp } from "@/lib/fonts";
import { pageMetadata } from "@/lib/seo";
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
    applicationName: SITE.name,
    authors: [{ name: SITE.author.name, url: SITE.author.url }],
    creator: SITE.author.name,
    keywords: ["robotics", "C++", "palletizing", "ROS 2", "MoveIt", "Eigen", "WebAssembly", "bin packing", "algorithms", "warehouse automation", "ロボティクス", "パレタイジング"],
    ...pageMetadata({ locale, path: "", title: t("title"), description: t("description"), absoluteTitle: true }),
    title: { default: t("title"), template: `%s · ${SITE.name}` },
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
