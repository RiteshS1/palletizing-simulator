import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { DOCS } from "@/lib/docs";
import { SITE } from "@/lib/site";

// Every page in every language, with hreflang alternates so search engines show the right one.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/docs", ...DOCS.filter((d) => d.slug !== "overview").map((d) => `/docs/${d.slug}`), ...["greedy", "extreme-points", "compare", "orders"].map((m) => `/simulator/${m}`)];
  return paths.flatMap((p) =>
    routing.locales.map((locale) => ({
      url: `${SITE.url}/${locale}${p}`,
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `${SITE.url}/${l}${p}`])) },
    })),
  );
}
