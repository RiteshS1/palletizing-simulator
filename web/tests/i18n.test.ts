import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import ja from "../messages/ja.json";
import { DOCS } from "@/lib/docs";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
}

describe("translations", () => {
  it("Japanese has exactly the same message keys as English", () => {
    expect(keys(ja).sort()).toEqual(keys(en).sort());
  });
  it("no Japanese message is left empty", () => {
    const flat = keys(ja).map((k) => k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], ja));
    expect(flat.every((v) => (Array.isArray(v) ? v.length > 0 : String(v).trim().length > 0))).toBe(true);
  });
  it("every docs chapter exists in both languages and has a title", () => {
    for (const locale of ["en", "ja"]) {
      const files = readdirSync(join(__dirname, "../src/content/docs", locale)).map((f) => f.replace(/\.mdx$/, ""));
      expect(files.sort()).toEqual(DOCS.map((d) => d.slug).sort());
    }
    for (const d of DOCS) {
      expect(en.docs.pages).toHaveProperty(d.slug);
      expect(ja.docs.pages).toHaveProperty(d.slug);
    }
  });
});
