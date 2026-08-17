/** Human-selected framework tags (not AI-inferred). */

export const ESG_EVAL_FRAMEWORKS = ["KCGS", "MSCI", "DJSI"] as const;
export const DISCLOSURE_FRAMEWORKS = ["KSSB", "GRI", "SASB"] as const;

export type EsgEvalFramework = (typeof ESG_EVAL_FRAMEWORKS)[number];
export type DisclosureFramework = (typeof DISCLOSURE_FRAMEWORKS)[number];

export function normalizeFrameworkList<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T[] {
  if (!Array.isArray(value)) return [];
  const set = new Set(allowed);
  return value
    .map(String)
    .filter((v): v is T => set.has(v as T));
}
