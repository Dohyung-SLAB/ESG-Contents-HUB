/**
 * Supabase env helpers.
 * When not configured, the app falls back to the in-memory pilot store.
 */

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !secret) return false;
  if (url.includes("your-project")) return false;
  if (anon.includes("your-anon-key") || anon === "your-publishable-key") return false;
  if (secret.includes("your-service-role") || secret === "your-secret-key") return false;
  return true;
}

export function getSupabaseEnv() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase가 설정되지 않았습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 넣으세요.",
    );
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
  };
}
