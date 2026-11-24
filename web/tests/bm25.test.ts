import { describe, expect, it } from "vitest";
import knowledge from "@/generated/knowledge";
import { buildIndex, search, tokenize } from "@/lib/ai/bm25";

describe("tokenize", () => {
  it("keeps code-ish words and drops stop words", () => {
    expect(tokenize("Why is C++ used for the robot?")).toEqual(["c++", "used", "robot"]);
  });
  it("splits Japanese into character bigrams", () => {
    expect(tokenize("重心")).toEqual(["重心"]);
    expect(tokenize("支持多角形")).toEqual(["支持", "持多", "多角", "角形"]);
  });
});

describe("search", () => {
  const index = buildIndex([
    { id: "a", title: "Convex hull", kind: "doc", text: "Andrew's monotone chain builds the convex hull of the contact corners." },
    { id: "b", title: "Priority queue", kind: "doc", text: "Orders wait in a priority queue ordered by priority then deadline." },
    { id: "c", title: "Pallet", kind: "doc", text: "A pallet is a pallet is a pallet." },
  ]);
  it("ranks the chunk that contains the rare query terms first", () => {
    expect(search(index, "how does the monotone chain hull work")[0].chunk.id).toBe("a");
    expect(search(index, "priority queue deadline")[0].chunk.id).toBe("b");
  });
  it("returns nothing for unrelated queries", () => {
    expect(search(index, "banana smoothie")).toEqual([]);
  });
});

describe("the real knowledge index", () => {
  const index = knowledge;
  it("covers docs in both languages and the C++ sources", () => {
    expect(index.chunks.some((c) => c.locale === "en")).toBe(true);
    expect(index.chunks.some((c) => c.locale === "ja")).toBe(true);
    expect(index.chunks.some((c) => c.id.startsWith("code:core/src/extreme_points.cpp"))).toBe(true);
  });
  it("answers an English question with the extreme points chapter", () => {
    const hits = search(index, "how are extreme points projected", 3, { locale: "en" });
    expect(hits.some((h) => h.chunk.url === "/en/docs/extreme-points")).toBe(true);
  });
  it("answers a Japanese question with Japanese docs", () => {
    const hits = search(index, "支持多角形とは何ですか", 3, { locale: "ja" });
    expect(hits[0].chunk.locale).toBe("ja");
  });
});
