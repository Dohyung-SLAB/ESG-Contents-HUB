/**
 * In-memory pilot data store for MVP demos when Supabase is not connected.
 * Initialized from Samlip seed constants. Mutations persist for the Node process lifetime.
 */

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
} from "@/lib/seed/samlip-pilot";
import type {
  AiSuggestion,
  AuditLog,
  Company,
  ContentBlock,
  ContentEvidence,
  ContentVersion,
  Evidence,
  ExtractionCandidate,
  ExtractionJob,
  Issue,
  KeyFact,
  Profile,
  Project,
  ProjectMember,
  Review,
} from "@/types/database";
import type { FormSchema } from "@/types/database";
import type { UserRole } from "@/types/enums";

const now = () => new Date().toISOString();

export type PilotStore = {
  companies: Company[];
  profiles: Profile[];
  projects: Project[];
  project_members: ProjectMember[];
  issues: Issue[];
  content_blocks: ContentBlock[];
  content_versions: ContentVersion[];
  key_facts: KeyFact[];
  evidences: Evidence[];
  content_evidences: ContentEvidence[];
  reviews: Review[];
  ai_suggestions: AiSuggestion[];
  extraction_jobs: ExtractionJob[];
  extraction_candidates: ExtractionCandidate[];
  audit_logs: AuditLog[];
  /** Demo session role (no real auth yet). */
  current_user_id: string;
  active_project_id: string;
};

declare global {
  var __esgPilotStore: PilotStore | undefined;
}

function buildInitialStore(): PilotStore {
  const ts = now();

  const profiles: Profile[] = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      company_id: SAMLIP_IDS.company,
      email: "admin@samlip.local",
      full_name: "Consultant Admin",
      role: "ADMIN",
      department: "컨설팅",
      created_at: ts,
      updated_at: ts,
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
      company_id: SAMLIP_IDS.company,
      email: "contributor@samlip.local",
      full_name: "품질보증 담당",
      role: "CONTRIBUTOR",
      department: "품질보증",
      created_at: ts,
      updated_at: ts,
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
      company_id: SAMLIP_IDS.company,
      email: "reviewer@samlip.local",
      full_name: "ESG 담당",
      role: "REVIEWER",
      department: "ESG",
      created_at: ts,
      updated_at: ts,
    },
  ];

  const companies: Company[] = [
    {
      id: SAMLIP_COMPANY.id,
      name: SAMLIP_COMPANY.name,
      brand_primary: SAMLIP_COMPANY.brand_primary,
      created_at: ts,
      updated_at: ts,
    },
  ];

  const projects: Project[] = SAMLIP_PROJECTS.map((p) => ({
    ...p,
    created_at: ts,
    updated_at: ts,
  }));

  const project_members: ProjectMember[] = profiles.flatMap((pr) =>
    projects.map((p) => ({
      id: newId(),
      project_id: p.id,
      profile_id: pr.id,
      member_role: pr.role,
      created_at: ts,
      updated_at: ts,
    })),
  );

  const issues: Issue[] = [
    {
      ...SAMLIP_ISSUE,
      created_at: ts,
      updated_at: ts,
    },
  ];

  const reviewerId = profiles[2].id;
  const contributorId = profiles[1].id;

  const content_blocks: ContentBlock[] = SAMLIP_BLOCKS.map((b) => {
    let owner_department = "품질보증";
    if (["CT-001", "CT-002", "CT-003"].includes(b.code)) owner_department = "ESG";
    if (["CT-016", "CT-017"].includes(b.code)) owner_department = "마케팅";
    if (["CT-014", "CT-015"].includes(b.code)) owner_department = "고객센터";

    return {
      id: blockId(b.n),
      issue_id: SAMLIP_IDS.issue,
      parent_block_id: null,
      code: b.code,
      section: b.section,
      sub_topic: b.sub_topic,
      title: b.title,
      content_type: b.content_type,
      update_type: b.update_type,
      owner_department,
      owner_user_id: null,
      reviewer_user_id: reviewerId,
      form_schema: (b.code === "CT-018"
        ? CT018_FORM_SCHEMA
        : {}) as FormSchema,
      display_order: b.n,
      is_active: true,
      created_at: ts,
      updated_at: ts,
    };
  });

  const content_versions: ContentVersion[] = SAMLIP_BLOCKS.flatMap((b) => {
    const v2026: ContentVersion = {
      id: versionId(b.n, 2026),
      content_block_id: blockId(b.n),
      reporting_year: 2026,
      previous_version_id: null,
      narrative:
        b.code === "CT-006"
          ? "위해상품 판매차단 시스템을 운영하고 있으며, 적용 매장은 188개입니다. 모의훈련은 반기 1회 실시합니다."
          : null,
      change_type: "NO_CHANGE",
      change_summary: null,
      status: "APPROVED",
      source_document: "2026 Sustainability Report",
      source_page: b.n,
      created_by: contributorId,
      updated_by: contributorId,
      approved_by: reviewerId,
      created_at: ts,
      updated_at: ts,
      approved_at: ts,
    };
    const v2027: ContentVersion = {
      id: versionId(b.n, 2027),
      content_block_id: blockId(b.n),
      reporting_year: 2027,
      previous_version_id: versionId(b.n, 2026),
      narrative: null,
      change_type: "PENDING",
      change_summary: null,
      status: "NOT_STARTED",
      source_document: null,
      source_page: null,
      created_by: null,
      updated_by: null,
      approved_by: null,
      created_at: ts,
      updated_at: ts,
      approved_at: null,
    };
    return [v2026, v2027];
  });

  const key_facts: KeyFact[] = [
    ...CT006_KEY_FACTS_2026.map((f) => ({
      ...f,
      content_version_id: versionId(6, 2026),
      created_at: ts,
      updated_at: ts,
    })),
    ...CT018_KEY_FACTS_2026.map((f) => ({
      ...f,
      content_version_id: versionId(18, 2026),
      created_at: ts,
      updated_at: ts,
    })),
  ];

  return {
    companies,
    profiles,
    projects,
    project_members,
    issues,
    content_blocks,
    content_versions,
    key_facts,
    evidences: [],
    content_evidences: [],
    reviews: [],
    ai_suggestions: [],
    extraction_jobs: [],
    extraction_candidates: [],
    audit_logs: [],
    current_user_id: profiles[0].id,
    active_project_id: SAMLIP_IDS.project2027,
  };
}

export function getPilotStore(): PilotStore {
  if (!globalThis.__esgPilotStore) {
    globalThis.__esgPilotStore = buildInitialStore();
  }
  return globalThis.__esgPilotStore;
}

export function resetPilotStore(): PilotStore {
  globalThis.__esgPilotStore = buildInitialStore();
  return globalThis.__esgPilotStore;
}

export function getCurrentUser(store = getPilotStore()): Profile {
  const user = store.profiles.find((p) => p.id === store.current_user_id);
  if (!user) throw new Error("Current user not found in pilot store");
  return user;
}

export function setCurrentUserRole(role: UserRole): Profile {
  const store = getPilotStore();
  const profile = store.profiles.find((p) => p.role === role);
  if (!profile) throw new Error(`No profile for role ${role}`);
  store.current_user_id = profile.id;
  return profile;
}

export function newId(prefix = "9"): string {
  const rand = crypto.randomUUID();
  return rand.replace(/^./, prefix.slice(0, 1));
}

export function touch(iso = now()) {
  return iso;
}
