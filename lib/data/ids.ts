/** Shared id / timestamp helpers (pilot + Supabase paths). */
export function newId(): string {
  return crypto.randomUUID();
}

export function touch(iso = new Date().toISOString()) {
  return iso;
}
