import { Archivo, Geist, Geist_Mono, Noto_Sans_JP } from "next/font/google";

// Archivo: a variable grotesque with a width axis; the expanded width gives headlines an
// engineered, industrial feel. Geist for UI text, Noto Sans JP for Japanese.
export const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
export const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
export const notoJp = Noto_Sans_JP({
  weight: ["400", "500", "700"],
  variable: "--font-noto-jp",
  display: "swap",
  preload: false, // large CJK font: only download when Japanese text is actually rendered
});
