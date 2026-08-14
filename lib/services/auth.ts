import {
  CONSULTANT_EMAIL_DOMAIN,
  isConsultantEmail,
  normalizeEmail,
} from "@/lib/auth-constants";
import {
  activateInvitesForProfile,
  listPendingInvitesForEmail,
} from "@/lib/services/invites";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";

export type SignUpInput = {
  email: string;
  password: string;
  full_name: string;
  department?: string | null;
};

export type SignInInput = {
  email: string;
  password: string;
};

export { CONSULTANT_EMAIL_DOMAIN, isConsultantEmail };

export async function signUp(input: SignUpInput): Promise<{ profile: Profile }> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase가 설정되어야 가입할 수 있습니다.");
  }

  const email = normalizeEmail(input.email);
  const fullName = input.full_name.trim();
  if (!email || !fullName) throw new Error("이름과 이메일은 필수입니다.");
  if (input.password.length < 8) {
    throw new Error("비밀번호는 8자 이상이어야 합니다.");
  }

  const consultant = isConsultantEmail(email);
  let role: UserRole = "ADMIN";
  let department: string | null = input.department?.trim() || null;

  if (consultant) {
    role = "ADMIN";
    department = department || "컨설팅";
  } else {
    const pending = await listPendingInvitesForEmail(email);
    if (pending.length === 0) {
      throw new Error(
        "가입할 수 없는 이메일입니다. 담당 컨설턴트가 미리 초대한 이메일만 고객사 계정으로 가입할 수 있습니다.",
      );
    }
    role = pending.some((i) => i.member_role === "REVIEWER")
      ? "REVIEWER"
      : "CONTRIBUTOR";
    department =
      input.department?.trim() ||
      pending.find((i) => i.department)?.department ||
      (role === "REVIEWER" ? "ESG" : null);
  }

  const admin = createSupabaseAdminClient();

  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
  if (createErr) {
    if (/already|registered|exists/i.test(createErr.message)) {
      throw new Error("이미 가입된 이메일입니다. 로그인하세요.");
    }
    throw new Error(createErr.message);
  }
  const userId = created.user?.id;
  if (!userId) throw new Error("사용자 생성에 실패했습니다.");

  const profile: Profile = {
    id: userId,
    company_id: null,
    email,
    full_name: fullName,
    role,
    department,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: pErr } = await admin.from("profiles").upsert(profile, {
    onConflict: "id",
  });
  if (pErr) throw new Error(pErr.message);

  if (!consultant) {
    const activated = await activateInvitesForProfile(userId, email);
    profile.role = activated.role === "ADMIN" ? "ADMIN" : activated.role;
    profile.company_id = activated.companyId;
  }

  const supabase = await createSupabaseServerClient();
  const { error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (signErr) throw new Error(signErr.message);

  return { profile };
}

export async function signIn(input: SignInInput): Promise<{ profile: Profile }> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase가 설정되어야 로그인할 수 있습니다.");
  }

  const email = normalizeEmail(input.email);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
  if (!data.user) throw new Error("로그인에 실패했습니다.");

  const admin = createSupabaseAdminClient();
  let { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    // Orphan auth user — only allow if consultant domain or pending invite
    const consultant = isConsultantEmail(email);
    if (!consultant) {
      const pending = await listPendingInvitesForEmail(email);
      if (pending.length === 0) {
        throw new Error(
          "프로필이 없고 초대도 없습니다. 컨설턴트 초대 후 다시 시도하세요.",
        );
      }
    }
    const row: Profile = {
      id: data.user.id,
      company_id: null,
      email: data.user.email ?? email,
      full_name:
        (data.user.user_metadata?.full_name as string | undefined) ??
        email.split("@")[0]!,
      role: consultant ? "ADMIN" : "CONTRIBUTOR",
      department: consultant ? "컨설팅" : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error: upsertErr } = await admin.from("profiles").upsert(row);
    if (upsertErr) throw new Error(upsertErr.message);
    if (!consultant) {
      await activateInvitesForProfile(row.id, email);
      const { data: refreshed } = await admin
        .from("profiles")
        .select("*")
        .eq("id", row.id)
        .maybeSingle();
      profile = refreshed ?? row;
    } else {
      profile = row;
    }
  }

  return { profile: profile as Profile };
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
}

export async function getAuthUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export function isConsultantRole(role: UserRole) {
  return role === "ADMIN";
}
