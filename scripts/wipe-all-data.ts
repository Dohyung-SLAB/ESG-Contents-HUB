/**
 * Wipe all ESG Content Hub business data and auth users.
 * Usage: npx tsx scripts/wipe-all-data.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), ".env.local") });

const TABLES = [
  "audit_logs",
  "ai_suggestions",
  "reviews",
  "content_evidences",
  "key_facts",
  "evidences",
  "content_versions",
  "content_blocks",
  "extraction_candidates",
  "extraction_jobs",
  "project_invites",
  "project_members",
  "issues",
  "projects",
  "profiles",
  "companies",
] as const;

async function deleteAllRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  table: string,
) {
  // Match all rows with a always-true predicate on uuid id / created_at
  const attempts = [
    () => admin.from(table).delete().not("id", "is", null),
    () => admin.from(table).delete().gte("created_at", "1970-01-01"),
  ];
  for (const run of attempts) {
    const { error } = await run();
    if (!error) {
      console.log("wiped", table);
      return;
    }
    if (/does not exist|Could not find|schema cache/i.test(error.message)) {
      console.log("skip_missing", table);
      return;
    }
  }
  console.warn("wipe_incomplete", table);
}

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

  for (const table of TABLES) {
    await deleteAllRows(admin, table);
  }

  // Clear invite storage fallback bucket
  try {
    const { data: files } = await admin.storage.from("app-invites").list("", {
      limit: 1000,
    });
    if (files?.length) {
      await admin.storage
        .from("app-invites")
        .remove(files.map((f) => f.name));
      console.log("wiped_storage_app-invites", files.length);
    }
  } catch {
    // bucket may not exist yet
  }

  let page = 1;
  let deleted = 0;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw new Error(error.message);
    const users = data.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
      if (delErr) console.warn("auth_delete_fail", u.email, delErr.message);
      else deleted += 1;
    }
    if (users.length < 100) break;
    page += 1;
  }

  console.log("WIPE_DONE", { authUsersDeleted: deleted });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
