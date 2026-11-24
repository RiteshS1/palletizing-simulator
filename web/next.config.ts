import createMDX from "@next/mdx";
import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  // Locale pages are pre-rendered per language with generateStaticParams + setRequestLocale
  // (the standard next-intl pattern), so we keep the classic rendering model here.
  cacheComponents: false,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  async headers() {
    return [
      {
        // The engine is content-hashed by nothing, so keep caches short but allow CDN reuse.
        source: "/wasm/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
};

// MDX docs: plugin names as strings so Turbopack can serialize the options.
const withMDX = createMDX({ options: { remarkPlugins: [["remark-gfm", {}]] } });
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withBotId(withNextIntl(withMDX(nextConfig)));
