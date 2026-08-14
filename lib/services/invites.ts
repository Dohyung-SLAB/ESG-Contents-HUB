import {
  CONSULTANT_EMAIL_DOMAIN,
  isConsultantEmail,
  normalizeEmail,
} from "@/lib/auth-constants";
import { newId, touch } from "@/lib/data/ids";
import { getSessionUser } from "@/lib/data/session";
import { writeAuditLog } from "@/lib/services/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type ClientInviteRole = "CONTRIBUTOR" | "REVIEWER";

export type ProjectInvite = {
  id: string;
  project_id: string;
  email: string;
  member_role: ClientInviteRole;
  department: string | null;
  invited_by: string | null;
  status: "PENDING" | "ACCEPTED" | "REVOKED";
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
};

export { CONSULTANT_EMAIL_DOMAIN, isConsultantEmail, normalizeEmail };

function assertConsultant(role: string) {
  if (role !== "ADMIN") {
    throw new Error("컨설턴트만 초대를 관리할 수 있습니다.");
  }
}

async function ensureInviteBucket() {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.createBucket("app-invites", {
    public: false,
    fileSizeLimit: 1_000_000,
  });
  if (error && !/already|exists/i.test(error.message)) {
    // ignore — bucket may already exist under another error shape
  }
}

async function useTableBackend(): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("project_invites").select("id").limit(1);
  return !error;
}

async function readStorageInvites(email: string): Promise<ProjectInvite[]> {
  await ensureInviteBucket();
  const admin = createSupabaseAdminClient();
  const path = `${normalizeEmail(email)}.json`;
  const { data, error } = await admin.storage.from("app-invites").download(path);
  if (error || !data) return [];
  const text = await data.text();
  try {
    const parsed = JSON.parse(text) as ProjectInvite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeStorageInvites(email: string, invites: ProjectInvite[]) {
  await ensureInviteBucket();
  const admin = createSupabaseAdminClient();
  const path = `${normalizeEmail(email)}.json`;
  const body = JSON.stringify(invites, null, 2);
  const { error } = await admin.storage
    .from("app-invites")
    .upload(path, body, {
      upsert: true,
      contentType: "application/json",
    });
  if (error) throw new Error(error.message);
}

export async function listPendingInvitesForEmail(
  email: string,
): Promise<ProjectInvite[]> {
  if (!isSupabaseConfigured()) return [];
  const normalized = normalizeEmail(email);
  if (await useTableBackend()) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("project_invites")
      .select("*")
      .eq("email", normalized)
      .eq("status", "PENDING");
    if (error) throw new Error(error.message);
    return (data ?? []) as ProjectInvite[];
  }
  return (await readStorageInvites(normalized)).filter(
    (i) => i.status === "PENDING",
  );
}

export async function listProjectInvites(
  projectId: string,
): Promise<ProjectInvite[]> {
  const user = await getSessionUser();
  assertConsultant(user.role);
  if (!isSupabaseConfigured()) return [];

  if (await useTableBackend()) {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("project_invites")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ProjectInvite[];
  }

  // Storage fallback: scan is limited; keep per-email files and filter
  await ensureInviteBucket();
  const admin = createSupabaseAdminClient();
  const { data: files } = await admin.storage.from("app-invites").list("", {
    limit: 1000,
  });
  const out: ProjectInvite[] = [];
  for (const f of files ?? []) {
    if (!f.name.endsWith(".json")) continue;
    const { data } = await admin.storage.from("app-invites").download(f.name);
    if (!data) continue;
    try {
      const parsed = JSON.parse(await data.text()) as ProjectInvite[];
      for (const inv of parsed) {
        if (inv.project_id === projectId) out.push(inv);
      }
    } catch {
      // skip bad file
    }
  }
  return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export type CreateInviteInput = {
  projectId: string;
  email: string;
  memberRole: ClientInviteRole;
  department?: string | null;
};

/**
 * Pre-register a client email for signup. If the user already exists, also
 * attach project membership immediately.
 */
export async function createProjectInvite(
  input: CreateInviteInput,
): Promise<ProjectInvite> {
  const actor = await getSessionUser();
  assertConsultant(actor.role);

  const email = normalizeEmail(input.email);
  if (!email.includes("@")) throw new Error("유효한 이메일을 입력하세요.");
  if (isConsultantEmail(email)) {
    throw new Error(
      `컨설턴트 도메인(@${CONSULTANT_EMAIL_DOMAIN})은 고객사 초대로 등록할 수 없습니다.`,
    );
  }
  if (!["CONTRIBUTOR", "REVIEWER"].includes(input.memberRole)) {
    throw new Error("현업(CONTRIBUTOR) 또는 ESG(REVIEWER)만 초대할 수 있습니다.");
  }

  const ts = touch();
  const invite: ProjectInvite = {
    id: newId(),
    project_id: input.projectId,
    email,
    member_role: input.memberRole,
    department:
      input.department?.trim() ||
      (input.memberRole === "REVIEWER" ? "ESG" : null),
    invited_by: actor.id,
    status: "PENDING",
    created_at: ts,
    updated_at: ts,
    accepted_at: null,
  };

  if (!isSupabaseConfigured()) {
    throw new Error("Supabase가 필요합니다.");
  }

  const admin = createSupabaseAdminClient();

  // Validate project exists and consultant is ADMIN member (or global ADMIN)
  const { data: project } = await admin
    .from("projects")
    .select("id,company_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");

  if (await useTableBackend()) {
    const { data, error } = await admin
      .from("project_invites")
      .upsert(
        {
          project_id: invite.project_id,
          email: invite.email,
          member_role: invite.member_role,
          department: invite.department,
          invited_by: invite.invited_by,
          status: "PENDING",
          updated_at: ts,
          accepted_at: null,
        },
        { onConflict: "project_id,email" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    Object.assign(invite, data);
  } else {
    const existing = await readStorageInvites(email);
    const next = existing.filter(
      (i) =>
        !(
          i.project_id === invite.project_id &&
          i.email === invite.email &&
          i.status === "PENDING"
        ),
    );
    next.push(invite);
    await writeStorageInvites(email, next);
  }

  // If profile already registered, activate membership now
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (profile) {
    await activateInvitesForProfile(profile.id, email);
  }

  await writeAuditLog({
    action: "ASSIGN_MEMBER",
    entity_type: "project_invites",
    entity_id: invite.id,
    before_data: null,
    after_data: {
      email,
      project_id: input.projectId,
      member_role: input.memberRole,
    },
  });

  return invite;
}

export async function revokeProjectInvite(inviteId: string, email: string) {
  const actor = await getSessionUser();
  assertConsultant(actor.role);
  const normalized = normalizeEmail(email);
  const admin = createSupabaseAdminClient();
  const ts = touch();

  if (await useTableBackend()) {
    const { error } = await admin
      .from("project_invites")
      .update({ status: "REVOKED", updated_at: ts })
      .eq("id", inviteId);
    if (error) throw new Error(error.message);
    return;
  }

  const invites = await readStorageInvites(normalized);
  await writeStorageInvites(
    normalized,
    invites.map((i) =>
      i.id === inviteId
        ? { ...i, status: "REVOKED" as const, updated_at: ts }
        : i,
    ),
  );
}

/** Apply all PENDING invites for this email → profile + memberships. */
export async function activateInvitesForProfile(
  profileId: string,
  email: string,
): Promise<{ role: ClientInviteRole | "ADMIN"; companyId: string | null }> {
  const admin = createSupabaseAdminClient();
  const normalized = normalizeEmail(email);
  const pending = await listPendingInvitesForEmail(normalized);
  const ts = touch();

  if (pending.length === 0) {
    return { role: "CONTRIBUTOR", companyId: null };
  }

  // Prefer REVIEWER if any invite is REVIEWER, else CONTRIBUTOR
  const role: ClientInviteRole = pending.some((i) => i.member_role === "REVIEWER")
    ? "REVIEWER"
    : "CONTRIBUTOR";
  const department =
    pending.find((i) => i.department)?.department ??
    (role === "REVIEWER" ? "ESG" : null);

  let companyId: string | null = null;
  for (const inv of pending) {
    const { data: project } = await admin
      .from("projects")
      .select("company_id")
      .eq("id", inv.project_id)
      .maybeSingle();
    if (project?.company_id) companyId = project.company_id;

    await admin.from("project_members").upsert(
      {
        project_id: inv.project_id,
        profile_id: profileId,
        member_role: inv.member_role,
        updated_at: ts,
      },
      { onConflict: "project_id,profile_id" },
    );

    if (await useTableBackend()) {
      await admin
        .from("project_invites")
        .update({
          status: "ACCEPTED",
          accepted_at: ts,
          updated_at: ts,
        })
        .eq("id", inv.id);
    }
  }

  if (!(await useTableBackend())) {
    const all = await readStorageInvites(normalized);
    await writeStorageInvites(
      normalized,
      all.map((i) =>
        i.status === "PENDING"
          ? {
              ...i,
              status: "ACCEPTED" as const,
              accepted_at: ts,
              updated_at: ts,
            }
          : i,
      ),
    );
  }

  await admin
    .from("profiles")
    .update({
      role,
      department,
      company_id: companyId,
      updated_at: ts,
    })
    .eq("id", profileId);

  return { role, companyId };
}
