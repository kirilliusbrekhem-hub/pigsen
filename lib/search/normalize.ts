/** Lowercases and strips markdown punctuation so SQLite LIKE matches Cyrillic case-insensitively. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[#*_`>|[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildSearchText(...parts: Array<string | null | undefined>): string {
  return normalize(parts.filter(Boolean).join(" "));
}

/** Splits a query into meaningful terms (drops 1-letter noise). */
export function queryTerms(q: string): string[] {
  return Array.from(new Set(normalize(q).split(" ").filter((t) => t.length > 1))).slice(0, 8);
}
