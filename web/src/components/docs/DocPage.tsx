import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { IslandLoader } from "@/components/docs/IslandLoader";
import { Link } from "@/i18n/navigation";
import { getDoc, neighbours } from "@/lib/docs";

const href = (slug: string) => (slug === "overview" ? "/docs" : `/docs/${slug}`);

export async function DocPage({ locale, slug }: { locale: string; slug: string }) {
  const doc = getDoc(slug);
  if (!doc) notFound();
  let Content: ComponentType;
  try {
    Content = (await import(`@/content/docs/${locale}/${slug}.mdx`)).default;
  } catch {
    notFound();
  }
  const t = await getTranslations("docs");
  const ts = await getTranslations("sim");
  const { prev, next } = neighbours(slug);

  return (
    <div className="grid gap-8 py-8 xl:grid-cols-[minmax(0,1fr)_minmax(380px,44%)] xl:py-10">
      {/* the 3D island first on small screens, sticky on the right on large ones */}
      <div className="order-first h-[46vh] min-h-[300px] xl:order-last xl:sticky xl:top-24 xl:h-[calc(100dvh-8rem)]">
        <IslandLoader scene={doc.scene} />
        {doc.simulator && (
          <Link href={`/simulator/${doc.simulator}`} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-ink underline decoration-signal underline-offset-4">
            {t("openInSimulator")}: {ts(`modes.${doc.simulator}`)}
          </Link>
        )}
      </div>
      <article id="main" className="prose-doc min-w-0">
        <Content />
        <nav className="mt-14 grid grid-cols-2 gap-3 border-t border-line pt-6 text-sm not-prose">
          {prev ? (
            <Link href={href(prev.slug)} className="group rounded-xs p-3 ring-1 ring-line hover:ring-ink/30">
              <span className="block text-mute">{t("prev")}</span>
              <span className="font-medium text-ink">{t(`pages.${prev.slug}`)}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={href(next.slug)} className="group rounded-xs p-3 text-right ring-1 ring-line hover:ring-ink/30">
              <span className="block text-mute">{t("next")}</span>
              <span className="font-medium text-ink">{t(`pages.${next.slug}`)}</span>
            </Link>
          )}
        </nav>
      </article>
    </div>
  );
}
