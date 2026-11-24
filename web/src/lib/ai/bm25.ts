// BM25 retrieval over a small inverted index: the classic search-engine ranking function.
//
//   score(doc, query) = Σ_term  IDF(term) · tf·(k1+1) / (tf + k1·(1 − b + b·len/avgLen))
//
// IDF rewards rare terms ("monotone", "Isometry3d") over common ones ("the", "box"); the tf part
// saturates (the 10th "pallet" adds little) and normalises for chunk length.
// Japanese has no spaces between words, so CJK runs are split into overlapping character
// bigrams ("重心" , "心の" ...), the standard trick for search without a morphological analyzer.

export interface KnowledgeChunk {
  id: string;
  title: string;
  url?: string;
  locale?: "en" | "ja";
  kind: "doc" | "code" | "notes";
  text: string;
}

export interface KnowledgeIndex {
  chunks: (KnowledgeChunk & { len: number; tf: Record<string, number> })[];
  df: Record<string, number>;
  avgLen: number;
}

const CJK = /[぀-ヿ㐀-鿿豈-﫿]/;
const STOP = new Set("a an and are as at be by for from has have how i in is it its of on or that the this to was what when where which why will with you your".split(" "));

export function tokenize(text: string): string[] {
  const out: string[] = [];
  const parts = text.toLowerCase().match(/[a-z0-9+#_]+|[぀-ヿ㐀-鿿豈-﫿]+/g) ?? [];
  for (const p of parts) {
    if (CJK.test(p)) {
      if (p.length === 1) out.push(p);
      for (let i = 0; i + 1 < p.length; i++) out.push(p.slice(i, i + 2));
    } else if (p.length > 1 && !STOP.has(p)) {
      out.push(p);
    }
  }
  return out;
}

export function buildIndex(chunks: KnowledgeChunk[]): KnowledgeIndex {
  const df: Record<string, number> = {};
  let total = 0;
  const indexed = chunks.map((c) => {
    const terms = tokenize(`${c.title} ${c.text}`);
    const tf: Record<string, number> = {};
    for (const t of terms) tf[t] = (tf[t] ?? 0) + 1;
    for (const t of Object.keys(tf)) df[t] = (df[t] ?? 0) + 1;
    total += terms.length;
    return { ...c, len: terms.length, tf };
  });
  return { chunks: indexed, df, avgLen: total / Math.max(1, chunks.length) };
}

export interface SearchHit {
  chunk: KnowledgeChunk;
  score: number;
}

export function search(index: KnowledgeIndex, query: string, k = 6, opts: { locale?: string; k1?: number; b?: number } = {}): SearchHit[] {
  const { k1 = 1.2, b = 0.75 } = opts;
  const N = index.chunks.length;
  const q = [...new Set(tokenize(query))];
  const hits: SearchHit[] = [];
  for (const c of index.chunks) {
    let score = 0;
    for (const term of q) {
      const tf = c.tf[term];
      if (!tf) continue;
      const n = index.df[term] ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * c.len) / index.avgLen));
    }
    if (score <= 0) continue;
    if (opts.locale && c.locale && c.locale === opts.locale) score *= 1.25; // prefer the reader's language
    const { tf: _tf, len: _len, ...chunk } = c;
    void _tf;
    void _len;
    hits.push({ chunk, score });
  }
  return hits.sort((x, y) => y.score - x.score).slice(0, k);
}
