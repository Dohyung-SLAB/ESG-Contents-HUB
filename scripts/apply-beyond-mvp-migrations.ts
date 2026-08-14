/**
 * Apply beyond-MVP migrations via service role (project_members, toc_section, reports bucket).
 * Usage: npx tsx scripts/apply-beyond-mvp-migrations.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
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

  // Prefer Dashboard SQL Editor for full DDL; here we upsert members if table exists.
  const files = [
    "supabase/migrations/20260813000002_project_members.sql",
    "supabase/migrations/20260813000003_extraction_toc.sql",
  ];

  console.log(
    "Apply these SQL files in Supabase SQL Editor (service role REST cannot run arbitrary DDL reliably):",
  );
  for (const f of files) {
    const abs = resolve(process.cwd(), f);
    const sql = readFileSync(abs, "utf8");
    console.log("\n====", f, "====\n");
    console.log(sql.slice(0, 200) + "...\n");
  }

  // Best-effort: seed memberships if table already created
  const { data: profiles } = await admin.from("profiles").select("id,role");
  const { data: projects } = await admin
    .from("projects")
    .select("id")
    .in("id", [
      "22222222-2222-4222-8222-222222222201",
      "22222222-2222-4222-8222-222222222202",
    ]);

  if (profiles && projects) {
    for (const p of projects) {
      for (const pr of profiles) {
        const { error } = await admin.from("project_members").upsert(
          {
            project_id: p.id,
            profile_id: pr.id,
            member_role: pr.role,
          },
          { onConflict: "project_id,profile_id" },
        );
        if (error) {
          console.warn(
            "project_members upsert skipped (run migration SQL first):",
            error.message,
          );
          process.exit(0);
        }
      }
    }
    console.log("project_members seeded for Samlip projects");
  }

  // Ensure reports bucket
  const { error: bucketErr } = await admin.storage.createBucket("reports", {
    public: false,
    fileSizeLimit: 52428800,
    allowedMimeTypes: ["application/pdf"],
  });
  if (bucketErr && !bucketErr.message.toLowerCase().includes("already")) {
    console.warn("reports bucket:", bucketErr.message);
  } else {
    console.log("reports bucket ready");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
