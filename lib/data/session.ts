import { cookies } from "next/headers";

import {
  DEMO_USERS,
  SESSION_PROJECT_COOKIE,
  SESSION_ROLE_COOKIE,
} from "@/lib/data/demo-users";
import {
  getCurrentUser as getPilotCurrentUser,
  getPilotStore,
  setCurrentUserRole as setPilotRole,
} from "@/lib/data/pilot-store";
import { SAMLIP_IDS } from "@/lib/seed/samlip-pilot";
import { getAuthUserId } from "@/lib/services/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";

/**
 * Resolve the signed-in profile.
 * Prefer Supabase Auth session; fall back to demo role cookie only when
 * there is no auth session (local/demo convenience for consultants).
 */
export async function getSessionUser(): Promise<Profile> {
  if (!isSupabaseConfigured()) {
    return getPilotCurrentUser();
  }

  const authUserId = await getAuthUserId();
  const admin = createSupabaseAdminClient();

  if (authUserId) {
    const { data, error } = await admin
      .from("profiles")
      .select("*")
      .eq("id", authUserId)
      .maybeSingle();
    if (!error && data) return data as Profile;

    // Auth user without profile — create a waiting-room client profile.
    const { data: authData } = await admin.auth.admin.getUserById(authUserId);
    const email = authData.user?.email ?? `${authUserId}@unknown.local`;
    const fullName =
      (authData.user?.user_metadata?.full_name as string | undefined) ??
      email.split("@")[0]!;
    const row: Profile = {
      id: authUserId,
      company_id: null,
      email,
      full_name: fullName,
      role: "CONTRIBUTOR",
      department: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await admin.from("profiles").upsert(row, { onConflict: "id" });
    return row;
  }

  // No auth session: demo cookie fallback (Settings role switcher / local QA).
  const cookieStore = await cookies();
  const role =
    (cookieStore.get(SESSION_ROLE_COOKIE)?.value as UserRole | undefined) ??
    "ADMIN";

  const { data, error } = await admin
    .from("profiles")
    .select("*")
    .eq("role", role)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    const { data: anyProfile } = await admin
      .from("profiles")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (anyProfile) return anyProfile as Profile;

    const demo = DEMO_USERS.find((u) => u.role === role) ?? DEMO_USERS[0];
    return {
      id: demo.id,
      company_id: null,
      email: demo.email,
      full_name: demo.full_name,
      role: demo.role,
      department: demo.department,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  return data as Profile;
}

/** True when the user has a real Supabase Auth session. */
export async function hasAuthSession(): Promise<boolean> {
  return (await getAuthUserId()) != null;
}

export async function setSessionRole(role: UserRole): Promise<void> {
  if (!isSupabaseConfigured()) {
    setPilotRole(role);
    return;
  }
  // Demo switcher only when not using a real auth session.
  if (await hasAuthSession()) {
    throw new Error(
      "실제 로그인 세션에서는 역할 전환을 사용할 수 없습니다. 로그아웃 후 Demo Role Switcher를 쓰거나, Settings에서 팀 배정으로 역할을 변경하세요.",
    );
  }
  const cookieStore = await cookies();
  cookieStore.set(SESSION_ROLE_COOKIE, role, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getActiveProjectId(): Promise<string> {
  if (!isSupabaseConfigured()) {
    return getPilotStore().active_project_id || SAMLIP_IDS.project2027;
  }
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(SESSION_PROJECT_COOKIE)?.value;
  if (fromCookie) return fromCookie;
  return SAMLIP_IDS.project2027;
}

export async function setActiveProjectId(projectId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    getPilotStore().active_project_id = projectId;
    return;
  }
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_PROJECT_COOKIE, projectId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  } catch {
    // RSC cannot always write cookies; explicit switch actions will persist.
  }
}
