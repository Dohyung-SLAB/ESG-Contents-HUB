/**
 * Verify Supabase credentials from .env.local (no secrets printed).
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon || !secret) {
    console.error("MISSING_ENV");
    process.exit(1);
  }

  console.log("url_host", new URL(url).host);
  console.log("anon_prefix", anon.slice(0, 14));
  console.log("secret_prefix", secret.slice(0, 10));

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const pub = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const a = await admin.from("companies").select("id").limit(1);
  console.log(
    "admin_companies",
    a.error ? `${a.error.code}:${a.error.message}` : `ok:${a.data?.length ?? 0}`,
  );

  const b = await pub.from("companies").select("id").limit(1);
  console.log(
    "pub_companies",
    b.error ? `${b.error.code}:${b.error.message}` : `ok:${b.data?.length ?? 0}`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
