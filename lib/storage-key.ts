/**
 * Supabase Storage object-key sanitizer.
 * Storage returns "Invalid key: …" for spaces and many non-ASCII characters.
 * Display/DB can keep the original filename separately.
 */
export function toStorageObjectName(filename: string): string {
  const trimmed = filename.trim() || "file";
  const lastDot = trimmed.lastIndexOf(".");
  const ext =
    lastDot > 0 && lastDot < trimmed.length - 1
      ? trimmed.slice(lastDot).toLowerCase()
      : "";
  const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const slug =
    base
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^[_.\-]+|[_.\-]+$/g, "")
      .slice(0, 80) || "file";
  const safeExt = /^\.[a-z0-9]{1,10}$/i.test(ext) ? ext : "";
  return `${slug}${safeExt}`;
}
