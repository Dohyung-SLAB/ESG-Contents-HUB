/**
 * Seed Samlip pilot data into Supabase.
 * UI/Workflow test data only — not verified report facts.
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage: npm run seed:samlip
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

import {
  blockId,
  CT006_KEY_FACTS_2026,
  CT018_FORM_SCHEMA,
  CT018_KEY_FACTS_2026,
  SAMLIP_BLOCKS,
  SAMLIP_COMPANY,
  SAMLIP_IDS,
  SAMLIP_ISSUE,
  SAMLIP_PROJECTS,
  versionId,
} from "../lib/seed/samlip-pilot";

loadEnv({ path: resolve(process.cwd(), ".env.local") });
loadEnv({ path: resolve(process.cwd(), ".env") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Set them in .env.local, or apply supabase/seed.sql in the SQL Editor.",
    );
    process.exit(1);
  }

  if (url.includes("your-project")) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL still looks like a placeholder. Update .env.local.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Seeding Samlip pilot data...");

  const keyFactIds = [
    ...CT006_KEY_FACTS_2026.map((f) => f.id),
    ...CT018_KEY_FACTS_2026.map((f) => f.id),
  ];
  const blockIds = SAMLIP_BLOCKS.map((b) => blockId(b.n));
  const versionIds = SAMLIP_BLOCKS.flatMap((b) => [
    versionId(b.n, 2026),
    versionId(b.n, 2027),
  ]);

  // Children first for idempotent re-runs
  await deleteByIds(supabase, "key_facts", keyFactIds);
  await deleteByIds(supabase, "content_versions", versionIds);
  await deleteByIds(supabase, "content_blocks", blockIds);
  await deleteByIds(supabase, "issues", [SAMLIP_IDS.issue]);
  await deleteByIds(supabase, "projects", [
    SAMLIP_IDS.project2026,
    SAMLIP_IDS.project2027,
  ]);
  await deleteByIds(supabase, "companies", [SAMLIP_IDS.company]);

  const { error: companyError } = await supabase.from("companies").insert({
    id: SAMLIP_COMPANY.id,
    name: SAMLIP_COMPANY.name,
    brand_primary: SAMLIP_COMPANY.brand_primary,
  });
  if (companyError) throw companyError;

  const { error: projectsError } = await supabase
    .from("projects")
    .insert([...SAMLIP_PROJECTS]);
  if (projectsError) throw projectsError;

  const { error: issueError } = await supabase
    .from("issues")
    .insert({ ...SAMLIP_ISSUE });
  if (issueError) throw issueError;

  const blocks = SAMLIP_BLOCKS.map((block) => ({
    id: blockId(block.n),
    issue_id: SAMLIP_IDS.issue,
    parent_block_id: null,
    code: block.code,
    section: block.section,
    sub_topic: block.sub_topic,
    title: block.title,
    content_type: block.content_type,
    update_type: block.update_type,
    owner_department: null,
    owner_user_id: null,
    reviewer_user_id: null,
    form_schema:
      block.code === "CT-018" ? CT018_FORM_SCHEMA : ({} as Record<string, never>),
    display_order: block.n,
    is_active: true,
  }));

  const { error: blocksError } = await supabase
    .from("content_blocks")
    .insert(blocks);
  if (blocksError) throw blocksError;

  const approvedAt = new Date().toISOString();
  const versions2026 = SAMLIP_BLOCKS.map((block) => ({
    id: versionId(block.n, 2026),
    content_block_id: blockId(block.n),
    reporting_year: 2026,
    previous_version_id: null,
    narrative: null,
    change_type: "NO_CHANGE" as const,
    change_summary: null,
    status: "APPROVED" as const,
    source_document: null,
    source_page: null,
    created_by: null,
    updated_by: null,
    approved_by: null,
    approved_at: approvedAt,
  }));

  const { error: v2026Error } = await supabase
    .from("content_versions")
    .insert(versions2026);
  if (v2026Error) throw v2026Error;

  const versions2027 = SAMLIP_BLOCKS.map((block) => ({
    id: versionId(block.n, 2027),
    content_block_id: blockId(block.n),
    reporting_year: 2027,
    previous_version_id: versionId(block.n, 2026),
    narrative: null,
    change_type: "PENDING" as const,
    change_summary: null,
    status: "NOT_STARTED" as const,
    source_document: null,
    source_page: null,
    created_by: null,
    updated_by: null,
    approved_by: null,
    approved_at: null,
  }));

  const { error: v2027Error } = await supabase
    .from("content_versions")
    .insert(versions2027);
  if (v2027Error) throw v2027Error;

  const keyFacts = [
    ...CT006_KEY_FACTS_2026.map((fact) => ({
      ...fact,
      content_version_id: versionId(6, 2026),
    })),
    ...CT018_KEY_FACTS_2026.map((fact) => ({
      ...fact,
      content_version_id: versionId(18, 2026),
    })),
  ];

  const { error: keyFactsError } = await supabase
    .from("key_facts")
    .insert(keyFacts);
  if (keyFactsError) throw keyFactsError;

  // Verification queries
  const { count: blockCount, error: blockCountError } = await supabase
    .from("content_blocks")
    .select("*", { count: "exact", head: true })
    .eq("issue_id", SAMLIP_IDS.issue);
  if (blockCountError) throw blockCountError;

  const { data: ct006Facts, error: ct006Error } = await supabase
    .from("key_facts")
    .select("key, value_number, value_text, value_type, unit")
    .eq("content_version_id", versionId(6, 2026))
    .order("display_order");
  if (ct006Error) throw ct006Error;

  const { data: ct018Facts, error: ct018Error } = await supabase
    .from("key_facts")
    .select("key, value_number, value_text, value_type, unit")
    .eq("content_version_id", versionId(18, 2026))
    .order("display_order");
  if (ct018Error) throw ct018Error;

  const { data: ct006Link, error: linkError } = await supabase
    .from("content_versions")
    .select("id, reporting_year, status, change_type, previous_version_id")
    .eq("content_block_id", blockId(6))
    .order("reporting_year");
  if (linkError) throw linkError;

  console.log(`content_blocks: ${blockCount ?? 0}`);
  console.log("CT-006 versions:", ct006Link);
  console.log("CT-006 key_facts:", ct006Facts);
  console.log("CT-018 key_facts:", ct018Facts);
  console.log("Seed completed.");
}

async function deleteByIds(
  supabase: SupabaseClient,
  table: string,
  ids: string[],
) {
  if (ids.length === 0) return;
  const { error } = await supabase.from(table).delete().in("id", ids);
  if (error) {
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
