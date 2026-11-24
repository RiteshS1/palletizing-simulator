// Next.js 16 "proxy" (formerly middleware): runs before every page request.
// next-intl negotiates the locale from the URL, the NEXT_LOCALE cookie, or the browser's
// Accept-Language header (a Japanese browser on "/" is redirected to "/ja").
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals, Vercel internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
