/**
 * Create demo auth users + profiles and assign block owners.
 * Usage: npx tsx scripts/ensure-demo-users.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

import {
  DEMO_COMPANY_ID,
  DEMO_REVIEWER_ID,
  DEMO_USERS,
} from "../lib/data/demo-users";
import { SAMLIP_IDS } from "../lib/seed/samlip-pilot";

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

  for (const user of DEMO_USERS) {
    const existing = await admin.auth.admin.listUsers({ perPage: 200 });
    const found = existing.data.users.find((u) => u.email === user.email);

    let userId = found?.id;
    if (!userId) {
      const created = await admin.auth.admin.createUser({
        id: user.id,
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name, role: user.role },
      });
      if (created.error) {
        console.error("createUser failed", user.email, created.error.message);
        process.exit(1);
      }
      userId = created.data.user.id;
      console.log("created_user", user.email, userId);
    } else {
      console.log("existing_user", user.email, userId);
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        company_id: null,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
      },
      { onConflict: "id" },
    );
    if (profileError) {
      console.error("profile upsert failed", profileError.message);
      process.exit(1);
    }
  }

  // Resolve actual IDs by email (in case createUser ignored custom id)
  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id,email,role");
  if (profilesError) {
    console.error(profilesError.message);
    process.exit(1);
  }

  const contributor =
    profiles?.find((p) => p.email === "contributor@samlip.local")?.id ?? null;
  const reviewer =
    profiles?.find((p) => p.email === "reviewer@samlip.local")?.id ??
    DEMO_REVIEWER_ID;

  // Department-scoped ownership: Contributor matches by owner_department
  const { data: blocks, error: listErr } = await admin
    .from("content_blocks")
    .select("id,code")
    .eq("issue_id", SAMLIP_IDS.issue);
  if (listErr) {
    console.error(listErr.message);
    process.exit(1);
  }

  for (const block of blocks ?? []) {
    let department = "품질보증";
    if (["CT-001", "CT-002", "CT-003"].includes(block.code)) department = "ESG";
    if (["CT-016", "CT-017"].includes(block.code)) department = "마케팅";
    if (["CT-014", "CT-015"].includes(block.code)) department = "고객센터";

    const { error: blockError } = await admin
      .from("content_blocks")
      .update({
        owner_user_id: null,
        reviewer_user_id: reviewer,
        owner_department: department,
      })
      .eq("id", block.id);
    if (blockError) {
      console.error("block update failed", block.code, blockError.message);
      process.exit(1);
    }
  }

  // Refresh profile display names / departments
  for (const user of DEMO_USERS) {
    await admin
      .from("profiles")
      .update({
        full_name: user.full_name,
        department: user.department,
        role: user.role,
      })
      .eq("email", user.email);
  }

  // Ensure demo users are members of Samlip projects (+ any orphaned projects for admin)
  const { data: allProjects } = await admin.from("projects").select("id");
  const projectIds = (allProjects ?? []).map((p) => p.id);
  const profileByEmail = new Map(
    (profiles ?? []).map((p) => [p.email, p] as const),
  );

  for (const demo of DEMO_USERS) {
    const profileId = profileByEmail.get(demo.email)?.id;
    if (!profileId) continue;
    for (const projectId of projectIds) {
      // Admin → all projects; others → Samlip only
      if (
        demo.role !== "ADMIN" &&
        projectId !== SAMLIP_IDS.project2026 &&
        projectId !== SAMLIP_IDS.project2027
      ) {
        continue;
      }
      await admin.from("project_members").upsert(
        {
          project_id: projectId,
          profile_id: profileId,
          member_role: demo.role,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id,profile_id" },
      );
    }
  }

  console.log("demo_users_ready", {
    contributor,
    reviewer,
    blocks: blocks?.length,
    profiles: profiles?.length,
    projects: projectIds.length,
  });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
