import { defineRouting } from "next-intl/routing";

// English is the source language; Japanese is fully translated.
// A visitor's browser language (Accept-Language) picks the locale on first visit;
// the language switcher stores an explicit choice in the NEXT_LOCALE cookie.
export const routing = defineRouting({
  locales: ["en", "ja"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
