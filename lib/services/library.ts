import { newId, touch } from "@/lib/data/ids";
import { getPilotStore } from "@/lib/data/pilot-store";
import { getSessionUser } from "@/lib/data/session";
import { getActiveWorkspace, listIssuesForActiveProject } from "@/lib/services/projects";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  ContentBlock,
  ContentVersion,
  Evidence,
  KeyFact,
  Profile,
} from "@/types/database";
import type {
  ChangeType,
  ContentStatus,
  ContentType,
  UpdateType,
} from "@/types/enums";

export type LibraryBlockRow = ContentBlock & {
  change_type: ChangeType;
  status: ContentStatus;
  last_updated: string;
  owner_name: string | null;
  current_version: ContentVersion | null;
  previous_version: ContentVersion | null;
};

export type LibraryFilters = {
  section?: string;
  content_type?: ContentType | "";
  update_type?: UpdateType | "";
  owner?: string;
  change_type?: ChangeType | "";
  status?: ContentStatus | "";
  q?: string;
  issueId?: string;
  blockId?: string;
};

function profileName(id: string | null, profiles: Profile[]) {
  if (!id) return null;
  return profiles.find((p) => p.id === id)?.full_name ?? null;
}

function applyListFilters(
  rows: LibraryBlockRow[],
  filters: LibraryFilters,
): LibraryBlockRow[] {
  let filtered = rows;
  if (filters.section) {
    filtered = filtered.filter((b) => b.section === filters.section);
  }
  if (filters.content_type) {
    filtered = filtered.filter((b) => b.content_type === filters.content_type);
  }
  if (filters.update_type) {
    filtered = filtered.filter((b) => b.update_type === filters.update_type);
  }
  if (filters.owner) {
    const o = filters.owner.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.owner_name?.toLowerCase().includes(o) ||
        b.owner_department?.toLowerCase().includes(o),
    );
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    filtered = filtered.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.sub_topic?.toLowerCase().includes(q) ?? false) ||
        b.code.toLowerCase().includes(q),
    );
  }
  if (filters.change_type) {
    filtered = filtered.filter((r) => r.change_type === filters.change_type);
  }
  if (filters.status) {
    filtered = filtered.filter((r) => r.status === filters.status);
  }
  return filtered.sort((a, b) => a.display_order - b.display_order);
}

export async function listLibraryBlocks(
  filters: LibraryFilters = {},
): Promise<LibraryBlockRow[]> {
  const { project, defaultIssue } = await getActiveWorkspace();
  const issues = await listIssuesForActiveProject();
  const issueIds = filters.issueId
    ? [filters.issueId]
    : issues.map((i) => i.id);
  const reportingYear = project.reporting_year;

  if (!isSupabaseConfigured()) {
    return listLibraryBlocksPilot(filters, issueIds, reportingYear);
  }

  if (issueIds.length === 0) return [];

  const admin = createSupabaseAdminClient();
  const [{ data: blocks, error: bErr }, { data: profiles }, { data: versions }] =
    await Promise.all([
      admin
        .from("content_blocks")
        .select("*")
        .in("issue_id", issueIds)
        .eq("is_active", true)
        .order("display_order"),
      admin.from("profiles").select("*"),
      admin.from("content_versions").select("*"),
    ]);

  if (bErr) throw new Error(bErr.message);
  const profileList = (profiles ?? []) as Profile[];
  const versionList = (versions ?? []) as ContentVersion[];

  const rows: LibraryBlockRow[] = ((blocks ?? []) as ContentBlock[]).map(
    (block) => {
      const current =
        versionList.find(
          (v) =>
            v.content_block_id === block.id &&
            v.reporting_year === reportingYear,
        ) ?? null;
      const previous = current?.previous_version_id
        ? (versionList.find((v) => v.id === current.previous_version_id) ?? null)
        : null;
      return {
        ...block,
        change_type: current?.change_type ?? "PENDING",
        status: current?.status ?? "NOT_STARTED",
        last_updated: current?.updated_at ?? block.updated_at,
        owner_name: profileName(block.owner_user_id, profileList),
        current_version: current,
        previous_version: previous,
      };
    },
  );

  void defaultIssue;
  return applyListFilters(rows, filters);
}

function listLibraryBlocksPilot(
  filters: LibraryFilters,
  issueIds: string[],
  reportingYear: number,
): LibraryBlockRow[] {
  const store = getPilotStore();
  let blocks = store.content_blocks.filter(
    (b) => issueIds.includes(b.issue_id) && b.is_active,
  );
  const rows: LibraryBlockRow[] = blocks.map((block) => {
    const current =
      store.content_versions.find(
        (v) =>
          v.content_block_id === block.id && v.reporting_year === reportingYear,
      ) ?? null;
    const previous = current?.previous_version_id
      ? (store.content_versions.find((v) => v.id === current.previous_version_id) ??
        null)
      : null;
    return {
      ...block,
      change_type: current?.change_type ?? "PENDING",
      status: current?.status ?? "NOT_STARTED",
      last_updated: current?.updated_at ?? block.updated_at,
      owner_name: profileName(block.owner_user_id, store.profiles),
      current_version: current,
      previous_version: previous,
    };
  });
  return applyListFilters(rows, filters);
}

export async function getBlockDetail(blockId: string) {
  if (!isSupabaseConfigured()) {
    return getBlockDetailPilot(blockId);
  }

  const admin = createSupabaseAdminClient();
  const { data: byId } = await admin
    .from("content_blocks")
    .select("*")
    .eq("id", blockId)
    .maybeSingle();
  let block = byId as ContentBlock | null;
  if (!block) {
    const { data: byCode } = await admin
      .from("content_blocks")
      .select("*")
      .eq("code", blockId)
      .maybeSingle();
    block = byCode as ContentBlock | null;
  }
  if (!block) return null;

  const [
    { data: versions },
    { data: issue },
    { data: profiles },
    { data: allFacts },
  ] = await Promise.all([
    admin
      .from("content_versions")
      .select("*")
      .eq("content_block_id", block.id)
      .order("reporting_year"),
    admin.from("issues").select("*").eq("id", block.issue_id).maybeSingle(),
    admin.from("profiles").select("*"),
    admin.from("key_facts").select("*"),
  ]);

  const { project } = await getActiveWorkspace();
  const reportingYear = project.reporting_year;
  const baseYear = project.base_year ?? reportingYear - 1;

  let versionList = (versions ?? []) as ContentVersion[];
  let current =
    versionList.find((v) => v.reporting_year === reportingYear) ?? null;
  let previous =
    versionList.find((v) => v.reporting_year === baseYear) ?? null;

  // Extraction used to create only the baseline year — backfill current year
  // so Annual Update / AI can run on existing blocks.
  if (!current && previous) {
    const user = await getSessionUser();
    const ts = touch();
    const row = {
      id: newId(),
      content_block_id: block.id,
      reporting_year: reportingYear,
      previous_version_id: previous.id,
      narrative: null as string | null,
      change_type: "PENDING" as const,
      change_summary: null as string | null,
      status: "NOT_STARTED" as const,
      source_document: null as string | null,
      source_page: null as number | null,
      created_by: user.id,
      updated_by: user.id,
      approved_by: null as string | null,
      created_at: ts,
      updated_at: ts,
      approved_at: null as string | null,
    };
    const { error: fillErr } = await admin.from("content_versions").insert(row);
    if (!fillErr) {
      versionList = [...versionList, row];
      current = row;
    }
  }
  const facts = (allFacts ?? []) as KeyFact[];
  const keyFactsFor = (versionId: string | undefined) =>
    versionId
      ? facts
          .filter((k) => k.content_version_id === versionId)
          .sort((a, b) => a.display_order - b.display_order)
      : [];

  let evidences: Array<{
    link: {
      id: string;
      content_version_id: string;
      evidence_id: string;
      relationship_type: string;
      created_at: string;
    };
    evidence: Evidence;
  }> = [];

  if (current) {
    const { data: links } = await admin
      .from("content_evidences")
      .select("*")
      .eq("content_version_id", current.id);
    const evidenceIds = (links ?? []).map((l) => l.evidence_id);
    const { data: evRows } =
      evidenceIds.length > 0
        ? await admin.from("evidences").select("*").in("id", evidenceIds)
        : { data: [] as Evidence[] };
    const evMap = new Map(((evRows ?? []) as Evidence[]).map((e) => [e.id, e]));
    evidences = (links ?? [])
      .map((link) => ({
        link,
        evidence: evMap.get(link.evidence_id) ?? null,
      }))
      .filter((x): x is (typeof evidences)[number] => x.evidence != null);
  }

  const profileList = (profiles ?? []) as Profile[];
  return {
    block,
    issue: issue ?? null,
    owner_name: profileName(block.owner_user_id, profileList),
    reviewer_name: profileName(block.reviewer_user_id, profileList),
    versions: versionList,
    current,
    previous,
    current_key_facts: keyFactsFor(current?.id),
    previous_key_facts: keyFactsFor(previous?.id),
    evidences,
  };
}

function getBlockDetailPilot(blockId: string) {
  const store = getPilotStore();
  const block =
    store.content_blocks.find((b) => b.id === blockId || b.code === blockId) ??
    null;
  if (!block) return null;
  const project =
    store.projects.find((p) => p.id === store.active_project_id) ??
    store.projects[0];
  const reportingYear = project?.reporting_year ?? 2027;
  const baseYear = project?.base_year ?? reportingYear - 1;
  const versions = store.content_versions
    .filter((v) => v.content_block_id === block.id)
    .sort((a, b) => a.reporting_year - b.reporting_year);
  const current = versions.find((v) => v.reporting_year === reportingYear) ?? null;
  const previous = versions.find((v) => v.reporting_year === baseYear) ?? null;
  const keyFactsFor = (versionId: string | undefined) =>
    versionId
      ? store.key_facts
          .filter((k) => k.content_version_id === versionId)
          .sort((a, b) => a.display_order - b.display_order)
      : [];
  const evidenceLinks = current
    ? store.content_evidences.filter((ce) => ce.content_version_id === current.id)
    : [];
  const evidences = evidenceLinks
    .map((link) => ({
      link,
      evidence: store.evidences.find((e) => e.id === link.evidence_id) ?? null,
    }))
    .filter((x) => x.evidence);
  return {
    block,
    issue: store.issues.find((i) => i.id === block.issue_id) ?? null,
    owner_name: profileName(block.owner_user_id, store.profiles),
    reviewer_name: profileName(block.reviewer_user_id, store.profiles),
    versions,
    current,
    previous,
    current_key_facts: keyFactsFor(current?.id),
    previous_key_facts: keyFactsFor(previous?.id),
    evidences,
  };
}

export async function listIssuesForCurrentProject() {
  return listIssuesForActiveProject();
}

export async function getKeyFacts(versionId: string): Promise<KeyFact[]> {
  if (!isSupabaseConfigured()) {
    return getPilotStore()
      .key_facts.filter((k) => k.content_version_id === versionId)
      .sort((a, b) => a.display_order - b.display_order);
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("key_facts")
    .select("*")
    .eq("content_version_id", versionId)
    .order("display_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as KeyFact[];
}

export async function resolveBlockId(
  blockIdOrCode: string,
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    const block = getPilotStore().content_blocks.find(
      (b) => b.id === blockIdOrCode || b.code === blockIdOrCode,
    );
    return block?.id ?? null;
  }
  const admin = createSupabaseAdminClient();
  const { data: byId } = await admin
    .from("content_blocks")
    .select("id")
    .eq("id", blockIdOrCode)
    .maybeSingle();
  if (byId) return byId.id;
  const { data: byCode } = await admin
    .from("content_blocks")
    .select("id")
    .eq("code", blockIdOrCode)
    .maybeSingle();
  return byCode?.id ?? null;
}

/** Persist human-selected ESG evaluation / disclosure framework tags on a content block. */
export async function updateContentBlockFrameworks(
  blockIdOrCode: string,
  patch: {
    esg_frameworks: string[];
    disclosure_frameworks: string[];
  },
): Promise<ContentBlock> {
  return updateContentBlockFields(blockIdOrCode, patch);
}

/** Update content block metadata (section, sub_topic, etc.). */
export async function updateContentBlockFields(
  blockIdOrCode: string,
  patch: Partial<{
    section: string;
    sub_topic: string | null;
    title: string;
    esg_frameworks: string[];
    disclosure_frameworks: string[];
  }>,
): Promise<ContentBlock> {
  const resolved = await resolveBlockId(blockIdOrCode);
  if (!resolved) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");

  const cleaned: Record<string, unknown> = { updated_at: touch() };
  if (patch.section !== undefined) {
    const section = patch.section.trim();
    if (!section) throw new Error("Section을 입력하세요.");
    cleaned.section = section;
  }
  if (patch.sub_topic !== undefined) {
    cleaned.sub_topic = patch.sub_topic?.trim() || null;
  }
  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (!title) throw new Error("제목을 입력하세요.");
    cleaned.title = title;
  }
  if (patch.esg_frameworks !== undefined) {
    cleaned.esg_frameworks = patch.esg_frameworks;
  }
  if (patch.disclosure_frameworks !== undefined) {
    cleaned.disclosure_frameworks = patch.disclosure_frameworks;
  }

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const block = store.content_blocks.find((b) => b.id === resolved);
    if (!block) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");
    Object.assign(block, cleaned);
    return block;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("content_blocks")
    .update(cleaned)
    .eq("id", resolved)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ContentBlock;
}

export async function getCompanyAndProject() {
  const { company, project } = await getActiveWorkspace();
  return { company, project };
}

export { getSessionUser as getCurrentUser };
export { getPilotStore, newId, touch };
export type { Evidence };
