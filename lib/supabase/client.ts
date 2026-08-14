import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client (auth session in cookies via @supabase/ssr). */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase 환경 변수가 없습니다.");
  }
  return createBrowserClient(url, anonKey);
}

/** @deprecated Use createSupabaseBrowserClient */
export function getSupabaseClient() {
  return createSupabaseBrowserClient();
}
