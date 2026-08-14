/**
 * Smoke test: read library + CT-006 update via service role.
 * Usage: npx tsx scripts/smoke-supabase-app.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { SAMLIP_IDS, versionId } from "../lib/seed/samlip-pilot";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count: blocks } = await admin
    .from("content_blocks")
    .select("*", { count: "exact", head: true })
    .eq("issue_id", SAMLIP_IDS.issue);

  const { data: profiles } = await admin.from("profiles").select("email,role");

  const v2027 = versionId(6, 2027);
  const { data: before } = await admin
    .from("content_versions")
    .select("status,change_type,narrative")
    .eq("id", v2027)
    .single();

  console.log(
    JSON.stringify(
      {
        ok: true,
        blocks,
        profiles,
        ct006_before: before,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
