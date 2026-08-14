/**
 * Verify schema + seed after SQL apply (no secrets printed).
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    console.error("MISSING_ENV");
    process.exit(1);
  }

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const checks = [
    ["companies", "id,name"],
    ["projects", "id,name,reporting_year,status"],
    ["issues", "id,name"],
    ["content_blocks", "id,code"],
    ["content_versions", "id,reporting_year,status"],
    ["key_facts", "id,key"],
  ] as const;

  for (const [table, cols] of checks) {
    const { data, error, count } = await admin
      .from(table)
      .select(cols, { count: "exact" })
      .limit(3);
    if (error) {
      console.log(`${table}: ERROR ${error.code} ${error.message}`);
    } else {
      console.log(`${table}: ok count=${count} sample=${JSON.stringify(data)}`);
    }
  }

  const { data: ct006, error: e6 } = await admin
    .from("content_blocks")
    .select("code,title,content_versions(reporting_year,status,key_facts(key,value_number,value_text,unit))")
    .eq("code", "CT-006")
    .maybeSingle();
  console.log(
    "CT-006:",
    e6 ? `ERROR ${e6.message}` : JSON.stringify(ct006, null, 0),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
