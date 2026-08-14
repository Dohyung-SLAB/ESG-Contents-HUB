import { newId, touch } from "@/lib/data/ids";
import { getCurrentUser as getPilotCurrentUser, getPilotStore } from "@/lib/data/pilot-store";
import { getSessionUser } from "@/lib/data/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AuditLog } from "@/types/database";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "SUBMIT"
  | "REQUEST_REVISION"
  | "APPROVE"
  | "EVIDENCE_UPLOAD"
  | "EVIDENCE_UNLINK"
  | "AI_SUGGESTION_APPLY"
  | "ASSIGN_MEMBER"
  | "REMOVE_MEMBER";

export async function writeAuditLog(input: {
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  before_data: Record<string, unknown> | object | null;
  after_data: Record<string, unknown> | object | null;
  user_id?: string | null;
}) {
  let userId = input.user_id;
  if (userId === undefined) {
    try {
      const user = isSupabaseConfigured()
        ? await getSessionUser()
        : getPilotCurrentUser();
      userId = user.id;
    } catch {
      userId = null;
    }
  }

  const entry: AuditLog = {
    id: newId(),
    user_id: userId ?? null,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    action: input.action,
    before_data: (input.before_data as Record<string, unknown> | null) ?? null,
    after_data: (input.after_data as Record<string, unknown> | null) ?? null,
    created_at: touch(),
  };

  if (!isSupabaseConfigured()) {
    getPilotStore().audit_logs.unshift(entry);
    return entry;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("audit_logs").insert(entry);
  if (error) {
    // Don't fail primary mutation if audit insert fails (e.g. FK)
    console.error("audit_log insert failed", error.message);
  }
  return entry;
}

export async function listAuditLogs(limit = 50) {
  if (!isSupabaseConfigured()) {
    return getPilotStore().audit_logs.slice(0, limit);
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLog[];
}
