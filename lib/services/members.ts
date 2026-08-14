/**
 * Project team membership: consultant assigns client users to projects.
 */
import { newId, touch } from "@/lib/data/ids";
import { getPilotStore } from "@/lib/data/pilot-store";
import { getSessionUser } from "@/lib/data/session";
import { writeAuditLog } from "@/lib/services/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile, ProjectMember } from "@/types/database";
import type { UserRole } from "@/types/enums";

export type MemberWithProfile = ProjectMember & {
  profile: Profile;
};

export type AssignMemberInput = {
  projectId: string;
  /** Existing profile email or id */
  email: string;
  memberRole: "CONTRIBUTOR" | "REVIEWER" | "ADMIN";
  department?: string | null;
};

function assertConsultant(user: Profile) {
  if (user.role !== "ADMIN") {
    throw new Error("컨설턴트(ADMIN)만 팀원을 배정할 수 있습니다.");
  }
}

export async function listUnassignedProfiles(): Promise<Profile[]> {
  const user = await getSessionUser();
  assertConsultant(user);

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const assigned = new Set(store.project_members.map((m) => m.profile_id));
    return store.profiles.filter(
      (p) => p.role !== "ADMIN" && !assigned.has(p.id),
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("*")
    .neq("role", "ADMIN")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const { data: memberships } = await admin
    .from("project_members")
    .select("profile_id");
  const assigned = new Set((memberships ?? []).map((m) => m.profile_id));

  return ((profiles ?? []) as Profile[]).filter((p) => !assigned.has(p.id));
}

export async function listProjectMembers(
  projectId: string,
): Promise<MemberWithProfile[]> {
  const user = await getSessionUser();
  assertConsultant(user);

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    return store.project_members
      .filter((m) => m.project_id === projectId)
      .map((m) => {
        const profile = store.profiles.find((p) => p.id === m.profile_id);
        if (!profile) return null;
        return { ...m, profile };
      })
      .filter((x): x is MemberWithProfile => x != null);
  }

  const admin = createSupabaseAdminClient();
  const { data: members, error } = await admin
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at");
  if (error) throw new Error(error.message);

  const ids = (members ?? []).map((m) => m.profile_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await admin
    .from("profiles")
    .select("*")
    .in("id", ids);
  const map = new Map(((profiles ?? []) as Profile[]).map((p) => [p.id, p]));

  return ((members ?? []) as ProjectMember[])
    .map((m) => {
      const profile = map.get(m.profile_id);
      if (!profile) return null;
      return { ...m, profile };
    })
    .filter((x): x is MemberWithProfile => x != null);
}

export async function listUserMembershipCount(
  profileId: string,
): Promise<number> {
  if (!isSupabaseConfigured()) {
    return getPilotStore().project_members.filter(
      (m) => m.profile_id === profileId,
    ).length;
  }
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("project_members")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Assign (or update) a client user on a project.
 * Syncs profiles.role / department / company_id with the assignment.
 */
export async function assignProjectMember(
  input: AssignMemberInput,
): Promise<MemberWithProfile> {
  const actor = await getSessionUser();
  assertConsultant(actor);

  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("이메일을 입력하세요.");
  if (!["CONTRIBUTOR", "REVIEWER", "ADMIN"].includes(input.memberRole)) {
    throw new Error("유효하지 않은 역할입니다.");
  }

  const ts = touch();

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const profile = store.profiles.find(
      (p) => p.email.toLowerCase() === email || p.id === email,
    );
    if (!profile) throw new Error("가입된 사용자를 찾을 수 없습니다.");

    const project = store.projects.find((p) => p.id === input.projectId);
    if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");

    profile.role = input.memberRole as UserRole;
    if (input.department !== undefined) {
      profile.department = input.department?.trim() || null;
    }
    if (input.memberRole !== "ADMIN") {
      profile.company_id = project.company_id;
    }
    profile.updated_at = ts;

    let member = store.project_members.find(
      (m) =>
        m.project_id === input.projectId && m.profile_id === profile.id,
    );
    if (member) {
      member.member_role = input.memberRole;
      member.updated_at = ts;
    } else {
      member = {
        id: newId(),
        project_id: input.projectId,
        profile_id: profile.id,
        member_role: input.memberRole,
        created_at: ts,
        updated_at: ts,
      };
      store.project_members.push(member);
    }
    return { ...member, profile };
  }

  const admin = createSupabaseAdminClient();

  // Verify actor is ADMIN member of this project (or any ADMIN)
  const { data: project, error: pErr } = await admin
    .from("projects")
    .select("*")
    .eq("id", input.projectId)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");

  const { data: actorMember } = await admin
    .from("project_members")
    .select("*")
    .eq("project_id", input.projectId)
    .eq("profile_id", actor.id)
    .maybeSingle();
  if (!actorMember || actorMember.member_role !== "ADMIN") {
    // Allow global ADMIN who created the company ecosystem
    if (actor.role !== "ADMIN") {
      throw new Error("이 프로젝트에 팀원을 배정할 권한이 없습니다.");
    }
  }

  const { data: profile, error: findErr } = await admin
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (!profile) {
    throw new Error(
      "가입된 사용자를 찾을 수 없습니다. 고객사 담당자에게 먼저 회원가입을 요청하세요.",
    );
  }

  const profilePatch: Record<string, unknown> = {
    role: input.memberRole,
    updated_at: ts,
  };
  if (input.department !== undefined) {
    profilePatch.department = input.department?.trim() || null;
  }
  if (input.memberRole === "CONTRIBUTOR" || input.memberRole === "REVIEWER") {
    profilePatch.company_id = project.company_id;
  }

  const { data: updatedProfile, error: upErr } = await admin
    .from("profiles")
    .update(profilePatch)
    .eq("id", profile.id)
    .select()
    .single();
  if (upErr) throw new Error(upErr.message);

  const { data: member, error: mErr } = await admin
    .from("project_members")
    .upsert(
      {
        project_id: input.projectId,
        profile_id: profile.id,
        member_role: input.memberRole,
        updated_at: ts,
      },
      { onConflict: "project_id,profile_id" },
    )
    .select()
    .single();
  if (mErr) throw new Error(mErr.message);

  await writeAuditLog({
    action: "ASSIGN_MEMBER",
    entity_type: "project_members",
    entity_id: member.id,
    before_data: null,
    after_data: {
      project_id: input.projectId,
      profile_id: profile.id,
      email,
      member_role: input.memberRole,
      department: input.department ?? null,
    },
  });

  return {
    ...(member as ProjectMember),
    profile: updatedProfile as Profile,
  };
}

export async function removeProjectMember(
  projectId: string,
  profileId: string,
): Promise<void> {
  const actor = await getSessionUser();
  assertConsultant(actor);
  if (actor.id === profileId) {
    throw new Error("자기 자신은 프로젝트에서 제거할 수 없습니다.");
  }

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    store.project_members = store.project_members.filter(
      (m) => !(m.project_id === projectId && m.profile_id === profileId),
    );
    return;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("profile_id", profileId);
  if (error) throw new Error(error.message);

  await writeAuditLog({
    action: "REMOVE_MEMBER",
    entity_type: "project_members",
    entity_id: profileId,
    before_data: { project_id: projectId, profile_id: profileId },
    after_data: null,
  });
}

/** Client user with no project membership → waiting room. */
export async function isAwaitingAssignment(
  profile?: Profile,
): Promise<boolean> {
  const user = profile ?? (await getSessionUser());
  if (user.role === "ADMIN") return false;
  const count = await listUserMembershipCount(user.id);
  return count === 0;
}
