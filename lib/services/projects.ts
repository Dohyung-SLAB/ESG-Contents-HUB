import { newId, touch } from "@/lib/data/ids";
import { getPilotStore } from "@/lib/data/pilot-store";
import {
  getActiveProjectId,
  getSessionUser,
  setActiveProjectId,
} from "@/lib/data/session";
import { writeAuditLog } from "@/lib/services/audit";
import {
  canAssignOwnerDepartment,
  canCreateProject,
  canDeleteProject,
} from "@/lib/services/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  Company,
  Issue,
  Project,
  ProjectMember,
} from "@/types/database";

export type ProjectWithCompany = Project & {
  company: Company;
};

async function ensureMember(
  projectId: string,
  profileId: string,
  memberRole: ProjectMember["member_role"],
) {
  const ts = touch();
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const exists = store.project_members.find(
      (m) => m.project_id === projectId && m.profile_id === profileId,
    );
    if (exists) {
      exists.member_role = memberRole;
      exists.updated_at = ts;
      return exists;
    }
    const row: ProjectMember = {
      id: newId(),
      project_id: projectId,
      profile_id: profileId,
      member_role: memberRole,
      created_at: ts,
      updated_at: ts,
    };
    store.project_members.push(row);
    return row;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("project_members")
    .upsert(
      {
        project_id: projectId,
        profile_id: profileId,
        member_role: memberRole,
        updated_at: ts,
      },
      { onConflict: "project_id,profile_id" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectMember;
}

async function bootstrapDefaultIssue(projectId: string, issueName: string) {
  const ts = touch();
  const issue: Issue = {
    id: newId(),
    project_id: projectId,
    name: issueName,
    category: "SOCIAL",
    display_order: 1,
    created_at: ts,
    updated_at: ts,
  };

  if (!isSupabaseConfigured()) {
    getPilotStore().issues.push(issue);
    return issue;
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("issues").insert(issue).select().single();
  if (error) throw new Error(error.message);
  return data as Issue;
}

export async function listCompanies(): Promise<Company[]> {
  if (!isSupabaseConfigured()) {
    return getPilotStore().companies.slice();
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("companies").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as Company[];
}

export async function listProjects(companyId?: string): Promise<Project[]> {
  if (!isSupabaseConfigured()) {
    const projects = getPilotStore().projects;
    return companyId
      ? projects.filter((p) => p.company_id === companyId)
      : projects.slice();
  }
  const admin = createSupabaseAdminClient();
  let q = admin.from("projects").select("*").order("reporting_year", {
    ascending: false,
  });
  if (companyId) q = q.eq("company_id", companyId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

export async function listProjectsForUser(): Promise<ProjectWithCompany[]> {
  const user = await getSessionUser();

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const memberProjectIds = new Set(
      store.project_members
        .filter((m) => m.profile_id === user.id)
        .map((m) => m.project_id),
    );
    return store.projects
      .filter((p) => memberProjectIds.has(p.id))
      .map((p) => {
        const company = store.companies.find((c) => c.id === p.company_id)!;
        return { ...p, company };
      })
      .sort((a, b) => b.reporting_year - a.reporting_year);
  }

  const admin = createSupabaseAdminClient();
  const { data: memberships, error: mErr } = await admin
    .from("project_members")
    .select("project_id")
    .eq("profile_id", user.id);
  if (mErr) throw new Error(mErr.message);

  const ids = (memberships ?? []).map((m) => m.project_id);
  if (ids.length === 0) {
    return [];
  }

  const { data: projects, error: pErr } = await admin
    .from("projects")
    .select("*")
    .in("id", ids)
    .order("reporting_year", { ascending: false });
  if (pErr) throw new Error(pErr.message);

  const companyIds = [...new Set((projects ?? []).map((p) => p.company_id))];
  const { data: companies } = await admin
    .from("companies")
    .select("*")
    .in("id", companyIds);
  const companyMap = new Map(
    ((companies ?? []) as Company[]).map((c) => [c.id, c]),
  );

  return ((projects ?? []) as Project[])
    .map((p) => ({
      ...p,
      company: companyMap.get(p.company_id)!,
    }))
    .filter((p) => p.company);
}

export async function assertProjectAccess(projectId: string) {
  const user = await getSessionUser();
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const member = store.project_members.find(
      (m) => m.project_id === projectId && m.profile_id === user.id,
    );
    if (!member) throw new Error("이 프로젝트에 접근할 수 없습니다.");
    return member;
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .eq("profile_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error("이 프로젝트에 접근할 수 없습니다.");
  }
  return data as ProjectMember;
}

export async function getActiveWorkspace(): Promise<{
  company: Company;
  project: Project;
  defaultIssue: Issue | null;
}> {
  const projects = await listProjectsForUser();
  if (projects.length === 0) {
    throw new Error("접근 가능한 프로젝트가 없습니다.");
  }

  let activeId = await getActiveProjectId();
  let selected = projects.find((p) => p.id === activeId) ?? projects[0];
  if (selected.id !== activeId) {
    await setActiveProjectId(selected.id);
    activeId = selected.id;
  }

  await assertProjectAccess(selected.id);

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const issues = store.issues
      .filter((i) => i.project_id === selected.id)
      .sort((a, b) => a.display_order - b.display_order);
    return {
      company: selected.company,
      project: selected,
      defaultIssue: issues[0] ?? null,
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: issues } = await admin
    .from("issues")
    .select("*")
    .eq("project_id", selected.id)
    .order("display_order")
    .limit(1);

  return {
    company: selected.company,
    project: selected,
    defaultIssue: ((issues ?? [])[0] as Issue | undefined) ?? null,
  };
}

export async function listIssuesForActiveProject(): Promise<Issue[]> {
  const { project } = await getActiveWorkspace();
  if (!isSupabaseConfigured()) {
    return getPilotStore()
      .issues.filter((i) => i.project_id === project.id)
      .sort((a, b) => a.display_order - b.display_order);
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("issues")
    .select("*")
    .eq("project_id", project.id)
    .order("display_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as Issue[];
}

export async function createCompanyAndProject(input: {
  company_name: string;
  project_name: string;
  reporting_year: number;
  base_year?: number | null;
  brand_primary?: string | null;
  issue_name?: string;
}) {
  const user = await getSessionUser();
  if (!canCreateProject(user.role)) {
    throw new Error("프로젝트 생성은 관리자(컨설턴트)만 가능합니다.");
  }

  const companyName = input.company_name.trim();
  const projectName = input.project_name.trim();
  if (!companyName) throw new Error("고객사 이름이 필요합니다.");
  if (!projectName) throw new Error("프로젝트 이름이 필요합니다.");
  if (input.reporting_year < 2000 || input.reporting_year > 2100) {
    throw new Error("보고 연도가 올바르지 않습니다.");
  }

  const ts = touch();
  const companyId = newId();
  const projectId = newId();

  const company: Company = {
    id: companyId,
    name: companyName,
    brand_primary: input.brand_primary ?? null,
    created_at: ts,
    updated_at: ts,
  };

  const project: Project = {
    id: projectId,
    company_id: companyId,
    name: projectName,
    reporting_year: input.reporting_year,
    base_year: input.base_year ?? input.reporting_year - 1,
    status: "ACTIVE",
    created_at: ts,
    updated_at: ts,
  };

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    store.companies.push(company);
    store.projects.push(project);
  } else {
    const admin = createSupabaseAdminClient();
    const { error: cErr } = await admin.from("companies").insert(company);
    if (cErr) throw new Error(cErr.message);
    const { error: pErr } = await admin.from("projects").insert(project);
    if (pErr) throw new Error(pErr.message);
  }

  await ensureMember(projectId, user.id, "ADMIN");
  const issue = await bootstrapDefaultIssue(
    projectId,
    input.issue_name?.trim() || "핵심 이슈",
  );
  await setActiveProjectId(projectId);

  await writeAuditLog({
    action: "CREATE",
    entity_type: "projects",
    entity_id: projectId,
    before_data: null,
    after_data: { company, project, issue },
  });

  return { company, project, issue };
}

export async function createProjectForCompany(input: {
  company_id: string;
  project_name: string;
  reporting_year: number;
  base_year?: number | null;
  issue_name?: string;
}) {
  const user = await getSessionUser();
  if (!canCreateProject(user.role)) {
    throw new Error("프로젝트 생성은 관리자(컨설턴트)만 가능합니다.");
  }

  const projectName = input.project_name.trim();
  if (!projectName) throw new Error("프로젝트 이름이 필요합니다.");

  const ts = touch();
  const project: Project = {
    id: newId(),
    company_id: input.company_id,
    name: projectName,
    reporting_year: input.reporting_year,
    base_year: input.base_year ?? input.reporting_year - 1,
    status: "ACTIVE",
    created_at: ts,
    updated_at: ts,
  };

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    if (!store.companies.some((c) => c.id === input.company_id)) {
      throw new Error("고객사를 찾을 수 없습니다.");
    }
    store.projects.push(project);
  } else {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("projects").insert(project);
    if (error) throw new Error(error.message);
  }

  await ensureMember(project.id, user.id, "ADMIN");
  const issue = await bootstrapDefaultIssue(
    project.id,
    input.issue_name?.trim() || "핵심 이슈",
  );
  await setActiveProjectId(project.id);

  await writeAuditLog({
    action: "CREATE",
    entity_type: "projects",
    entity_id: project.id,
    before_data: null,
    after_data: { project, issue },
  });

  return { project, issue };
}

function purgePilotProject(store: ReturnType<typeof getPilotStore>, projectId: string) {
  const issueIds = new Set(
    store.issues.filter((i) => i.project_id === projectId).map((i) => i.id),
  );
  const blockIds = new Set(
    store.content_blocks
      .filter((b) => issueIds.has(b.issue_id))
      .map((b) => b.id),
  );
  const versionIds = new Set(
    store.content_versions
      .filter((v) => blockIds.has(v.content_block_id))
      .map((v) => v.id),
  );
  const jobIds = new Set(
    store.extraction_jobs
      .filter((j) => j.project_id === projectId)
      .map((j) => j.id),
  );

  store.key_facts = store.key_facts.filter(
    (k) => !versionIds.has(k.content_version_id),
  );
  store.reviews = store.reviews.filter(
    (r) => !versionIds.has(r.content_version_id),
  );
  store.ai_suggestions = store.ai_suggestions.filter(
    (a) => !versionIds.has(a.content_version_id),
  );
  store.content_evidences = store.content_evidences.filter(
    (ce) => !versionIds.has(ce.content_version_id),
  );
  store.content_versions = store.content_versions.filter(
    (v) => !blockIds.has(v.content_block_id),
  );
  store.content_blocks = store.content_blocks.filter(
    (b) => !issueIds.has(b.issue_id),
  );
  store.issues = store.issues.filter((i) => i.project_id !== projectId);
  store.extraction_candidates = store.extraction_candidates.filter(
    (c) => !jobIds.has(c.job_id),
  );
  store.extraction_jobs = store.extraction_jobs.filter(
    (j) => j.project_id !== projectId,
  );
  store.project_members = store.project_members.filter(
    (m) => m.project_id !== projectId,
  );
  store.projects = store.projects.filter((p) => p.id !== projectId);
}

async function reassignActiveProjectIfNeeded(deletedProjectId: string) {
  const activeId = await getActiveProjectId();
  if (activeId !== deletedProjectId) return;

  try {
    const remaining = await listProjectsForUser();
    if (remaining[0]) {
      await setActiveProjectId(remaining[0].id);
    } else {
      await setActiveProjectId("");
    }
  } catch {
    await setActiveProjectId("");
  }
}

/** Delete a project (report year) and cascaded content. ADMIN only. */
export async function deleteProject(projectId: string) {
  const user = await getSessionUser();
  if (!canDeleteProject(user.role)) {
    throw new Error("프로젝트 삭제는 관리자(컨설턴트)만 가능합니다.");
  }

  let before: Project | null = null;

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    before = store.projects.find((p) => p.id === projectId) ?? null;
    if (!before) throw new Error("프로젝트를 찾을 수 없습니다.");
    purgePilotProject(store, projectId);
  } else {
    const admin = createSupabaseAdminClient();
    const { data, error: fetchErr } = await admin
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!data) throw new Error("프로젝트를 찾을 수 없습니다.");
    before = data as Project;

    const { error } = await admin.from("projects").delete().eq("id", projectId);
    if (error) throw new Error(error.message);
  }

  await reassignActiveProjectIfNeeded(projectId);

  await writeAuditLog({
    action: "DELETE",
    entity_type: "projects",
    entity_id: projectId,
    before_data: before,
    after_data: null,
  });

  return { ok: true as const, projectId };
}

/** Delete a client company and all its projects/reports. ADMIN only. */
export async function deleteCompany(companyId: string) {
  const user = await getSessionUser();
  if (!canDeleteProject(user.role)) {
    throw new Error("고객사 삭제는 관리자(컨설턴트)만 가능합니다.");
  }

  let before: Company | null = null;
  let projectIds: string[] = [];

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    before = store.companies.find((c) => c.id === companyId) ?? null;
    if (!before) throw new Error("고객사를 찾을 수 없습니다.");
    projectIds = store.projects
      .filter((p) => p.company_id === companyId)
      .map((p) => p.id);

    for (const pid of projectIds) {
      purgePilotProject(store, pid);
    }

    store.evidences = store.evidences.filter((e) => e.company_id !== companyId);
    store.profiles = store.profiles.map((p) =>
      p.company_id === companyId ? { ...p, company_id: null } : p,
    );
    store.companies = store.companies.filter((c) => c.id !== companyId);
  } else {
    const admin = createSupabaseAdminClient();
    const { data, error: fetchErr } = await admin
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!data) throw new Error("고객사를 찾을 수 없습니다.");
    before = data as Company;

    const { data: projects, error: pErr } = await admin
      .from("projects")
      .select("id")
      .eq("company_id", companyId);
    if (pErr) throw new Error(pErr.message);
    projectIds = (projects ?? []).map((p) => p.id);

    // Cascade: projects → issues → blocks → versions… ; evidences via company FK
    const { error } = await admin.from("companies").delete().eq("id", companyId);
    if (error) throw new Error(error.message);
  }

  for (const pid of projectIds) {
    await reassignActiveProjectIfNeeded(pid);
  }

  await writeAuditLog({
    action: "DELETE",
    entity_type: "companies",
    entity_id: companyId,
    before_data: { company: before, project_ids: projectIds },
    after_data: null,
  });

  return { ok: true as const, companyId, deletedProjectIds: projectIds };
}

export async function switchActiveProject(projectId: string) {
  await assertProjectAccess(projectId);
  await setActiveProjectId(projectId);
  return { ok: true as const, projectId };
}

export async function assignOwnerDepartment(input: {
  blockId: string;
  owner_department: string;
}) {
  const user = await getSessionUser();
  if (!canAssignOwnerDepartment(user.role)) {
    throw new Error("작성 부서 지정은 관리자 또는 Reviewer만 가능합니다.");
  }

  const department = input.owner_department.trim();
  if (!department) throw new Error("부서명을 입력하세요.");

  const ts = touch();

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const block = store.content_blocks.find(
      (b) => b.id === input.blockId || b.code === input.blockId,
    );
    if (!block) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");
    const before = { ...block };
    block.owner_department = department;
    block.owner_user_id = null;
    block.updated_at = ts;
    await writeAuditLog({
      action: "UPDATE",
      entity_type: "content_blocks",
      entity_id: block.id,
      before_data: before,
      after_data: block,
    });
    return block;
  }

  const admin = createSupabaseAdminClient();
  const { data: byId } = await admin
    .from("content_blocks")
    .select("*")
    .eq("id", input.blockId)
    .maybeSingle();
  let block = byId;
  if (!block) {
    const { data: byCode } = await admin
      .from("content_blocks")
      .select("*")
      .eq("code", input.blockId)
      .maybeSingle();
    block = byCode;
  }
  if (!block) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");

  const before = { ...block };
  const { data, error } = await admin
    .from("content_blocks")
    .update({
      owner_department: department,
      owner_user_id: null,
      updated_at: ts,
    })
    .eq("id", block.id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: "UPDATE",
    entity_type: "content_blocks",
    entity_id: block.id,
    before_data: before,
    after_data: data,
  });

  return data;
}
