import { newId, touch } from "@/lib/data/ids";
import { getPilotStore } from "@/lib/data/pilot-store";
import { getSessionUser } from "@/lib/data/session";
import { writeAuditLog } from "@/lib/services/audit";
import { resolveBlockId } from "@/lib/services/library";
import {
  canApproveNewContentRequest,
  canCreateNewContentRequest,
  sameDepartment,
} from "@/lib/services/permissions";
import { getActiveWorkspace } from "@/lib/services/projects";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ContentBlock, FormSchema } from "@/types/database";
import type { ContentType, UpdateType } from "@/types/enums";

export type NewContentRequestStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED";

export type NewContentMeta = {
  origin: "manual_new";
  request_status: NewContentRequestStatus;
  request_note: string | null;
  requested_by: string | null;
  requested_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
};

export function getNewContentMeta(
  block: Pick<ContentBlock, "form_schema">,
): NewContentMeta | null {
  const fs = (block.form_schema ?? {}) as FormSchema;
  if (fs.origin !== "manual_new") return null;
  const status = String(fs.request_status ?? "PENDING_APPROVAL");
  const request_status: NewContentRequestStatus =
    status === "APPROVED" || status === "REJECTED"
      ? status
      : "PENDING_APPROVAL";
  return {
    origin: "manual_new",
    request_status,
    request_note:
      typeof fs.request_note === "string" ? fs.request_note : null,
    requested_by:
      typeof fs.requested_by === "string" ? fs.requested_by : null,
    requested_at:
      typeof fs.requested_at === "string" ? fs.requested_at : null,
    reviewed_by:
      typeof fs.reviewed_by === "string" ? fs.reviewed_by : null,
    reviewed_at:
      typeof fs.reviewed_at === "string" ? fs.reviewed_at : null,
    reject_reason:
      typeof fs.reject_reason === "string" ? fs.reject_reason : null,
  };
}

/** Extracted / approved-new blocks can be written; pending/rejected requests cannot. */
export function isNewContentWriteUnlocked(
  block: Pick<ContentBlock, "form_schema">,
) {
  const meta = getNewContentMeta(block);
  if (!meta) return true;
  return meta.request_status === "APPROVED";
}

export function isPendingNewContentRequest(
  block: Pick<ContentBlock, "form_schema" | "is_active">,
) {
  if (!block.is_active) return false;
  const meta = getNewContentMeta(block);
  return meta?.request_status === "PENDING_APPROVAL";
}

export type CreateNewContentInput = {
  title: string;
  section: string;
  sub_topic?: string | null;
  content_type: ContentType;
  update_type: UpdateType;
  owner_department?: string | null;
  request_note?: string | null;
  issue_id?: string | null;
};

function buildRequestSchema(input: {
  note: string | null;
  userId: string;
  ts: string;
}): FormSchema {
  return {
    origin: "manual_new",
    request_status: "PENDING_APPROVAL",
    request_note: input.note,
    requested_by: input.userId,
    requested_at: input.ts,
    reviewed_by: null,
    reviewed_at: null,
    reject_reason: null,
  };
}

export async function createNewContentRequest(input: CreateNewContentInput) {
  const user = await getSessionUser();
  if (!canCreateNewContentRequest(user.role)) {
    throw new Error("신규 컨텐츠를 요청할 권한이 없습니다.");
  }

  const title = input.title.trim();
  const section = input.section.trim();
  if (!title) throw new Error("제목을 입력하세요.");
  if (!section) throw new Error("Section(목차)을 입력하세요.");

  let ownerDepartment = (input.owner_department ?? "").trim() || null;
  if (user.role === "CONTRIBUTOR") {
    if (!user.department?.trim()) {
      throw new Error("프로필에 부서가 없습니다. Settings에서 부서를 확인하세요.");
    }
    ownerDepartment = user.department.trim();
  } else if (!ownerDepartment) {
    throw new Error("작성 부서를 지정하세요.");
  }

  const workspace = await getActiveWorkspace();
  const issueId =
    input.issue_id?.trim() || workspace.defaultIssue?.id || null;
  if (!issueId) {
    throw new Error("프로젝트에 Issue가 없습니다. Settings에서 생성하세요.");
  }

  const reportingYear = workspace.project.reporting_year;
  const ts = touch();
  const note = input.request_note?.trim() || null;
  const form_schema = buildRequestSchema({
    note,
    userId: user.id,
    ts,
  });

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const code = `CT-N${String(store.content_blocks.length + 1).padStart(2, "0")}`;
    const blockId = newId();
    const versionId = newId();
    store.content_blocks.push({
      id: blockId,
      issue_id: issueId,
      parent_block_id: null,
      code,
      section,
      sub_topic: input.sub_topic?.trim() || null,
      title,
      content_type: input.content_type,
      update_type: input.update_type,
      owner_department: ownerDepartment,
      owner_user_id: user.role === "CONTRIBUTOR" ? user.id : null,
      reviewer_user_id: null,
      form_schema,
      display_order: store.content_blocks.length + 1,
      is_active: true,
      esg_frameworks: [],
      disclosure_frameworks: [],
      created_at: ts,
      updated_at: ts,
    });
    store.content_versions.push({
      id: versionId,
      content_block_id: blockId,
      reporting_year: reportingYear,
      previous_version_id: null,
      narrative: null,
      change_type: "NEW",
      change_summary: note,
      status: "NOT_STARTED",
      source_document: null,
      source_page: null,
      created_by: user.id,
      updated_by: user.id,
      approved_by: null,
      created_at: ts,
      updated_at: ts,
      approved_at: null,
    });
    void writeAuditLog({
      action: "CREATE",
      entity_type: "content_blocks",
      entity_id: blockId,
      before_data: null,
      after_data: { code, origin: "manual_new", request_status: "PENDING_APPROVAL" },
    });
    return { blockId, code, versionId };
  }

  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from("content_blocks")
    .select("*", { count: "exact", head: true });
  const code = `CT-N${String((count ?? 0) + 1).padStart(2, "0")}`;
  const blockId = newId();
  const versionId = newId();

  const { error: bErr } = await admin.from("content_blocks").insert({
    id: blockId,
    issue_id: issueId,
    parent_block_id: null,
    code,
    section,
    sub_topic: input.sub_topic?.trim() || null,
    title,
    content_type: input.content_type,
    update_type: input.update_type,
    owner_department: ownerDepartment,
    owner_user_id: user.role === "CONTRIBUTOR" ? user.id : null,
    reviewer_user_id: null,
    form_schema,
    display_order: (count ?? 0) + 1,
    is_active: true,
    esg_frameworks: [],
    disclosure_frameworks: [],
    created_at: ts,
    updated_at: ts,
  });
  if (bErr) throw new Error(bErr.message);

  const { error: vErr } = await admin.from("content_versions").insert({
    id: versionId,
    content_block_id: blockId,
    reporting_year: reportingYear,
    previous_version_id: null,
    narrative: null,
    change_type: "NEW",
    change_summary: note,
    status: "NOT_STARTED",
    source_document: null,
    source_page: null,
    created_by: user.id,
    updated_by: user.id,
    approved_by: null,
    created_at: ts,
    updated_at: ts,
    approved_at: null,
  });
  if (vErr) throw new Error(vErr.message);

  await writeAuditLog({
    action: "CREATE",
    entity_type: "content_blocks",
    entity_id: blockId,
    before_data: null,
    after_data: { code, origin: "manual_new", request_status: "PENDING_APPROVAL" },
  });

  return { blockId, code, versionId };
}

export async function approveNewContentRequest(blockIdOrCode: string) {
  const user = await getSessionUser();
  if (!canApproveNewContentRequest(user.role)) {
    throw new Error("신규 컨텐츠 요청 승인은 컨설턴트/ESG만 할 수 있습니다.");
  }

  const blockId = await resolveBlockId(blockIdOrCode);
  if (!blockId) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");

  const ts = touch();

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const block = store.content_blocks.find((b) => b.id === blockId);
    if (!block) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");
    const meta = getNewContentMeta(block);
    if (!meta) throw new Error("신규 컨텐츠 요청이 아닙니다.");
    if (meta.request_status !== "PENDING_APPROVAL") {
      throw new Error("대기 중인 요청만 승인할 수 있습니다.");
    }
    block.form_schema = {
      ...block.form_schema,
      request_status: "APPROVED",
      reviewed_by: user.id,
      reviewed_at: ts,
      reject_reason: null,
    };
    block.updated_at = ts;
    return { blockId, code: block.code };
  }

  const admin = createSupabaseAdminClient();
  const { data: block, error } = await admin
    .from("content_blocks")
    .select("*")
    .eq("id", blockId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!block) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");
  const meta = getNewContentMeta(block as ContentBlock);
  if (!meta) throw new Error("신규 컨텐츠 요청이 아닙니다.");
  if (meta.request_status !== "PENDING_APPROVAL") {
    throw new Error("대기 중인 요청만 승인할 수 있습니다.");
  }

  const nextSchema: FormSchema = {
    ...(block.form_schema as FormSchema),
    origin: "manual_new",
    request_status: "APPROVED",
    reviewed_by: user.id,
    reviewed_at: ts,
    reject_reason: null,
  };
  const { error: uErr } = await admin
    .from("content_blocks")
    .update({ form_schema: nextSchema, updated_at: ts })
    .eq("id", blockId);
  if (uErr) throw new Error(uErr.message);

  await writeAuditLog({
    action: "UPDATE",
    entity_type: "content_blocks",
    entity_id: blockId,
    before_data: { request_status: "PENDING_APPROVAL" },
    after_data: { request_status: "APPROVED" },
  });

  return { blockId, code: (block as ContentBlock).code };
}

export async function rejectNewContentRequest(
  blockIdOrCode: string,
  reason?: string | null,
) {
  const user = await getSessionUser();
  if (!canApproveNewContentRequest(user.role)) {
    throw new Error("신규 컨텐츠 요청 반려는 컨설턴트/ESG만 할 수 있습니다.");
  }

  const blockId = await resolveBlockId(blockIdOrCode);
  if (!blockId) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");
  const ts = touch();
  const rejectReason = reason?.trim() || null;

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const block = store.content_blocks.find((b) => b.id === blockId);
    if (!block) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");
    const meta = getNewContentMeta(block);
    if (!meta) throw new Error("신규 컨텐츠 요청이 아닙니다.");
    if (meta.request_status !== "PENDING_APPROVAL") {
      throw new Error("대기 중인 요청만 반려할 수 있습니다.");
    }
    block.form_schema = {
      ...block.form_schema,
      request_status: "REJECTED",
      reviewed_by: user.id,
      reviewed_at: ts,
      reject_reason: rejectReason,
    };
    block.is_active = false;
    block.updated_at = ts;
    return { blockId, code: block.code };
  }

  const admin = createSupabaseAdminClient();
  const { data: block, error } = await admin
    .from("content_blocks")
    .select("*")
    .eq("id", blockId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!block) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");
  const meta = getNewContentMeta(block as ContentBlock);
  if (!meta) throw new Error("신규 컨텐츠 요청이 아닙니다.");
  if (meta.request_status !== "PENDING_APPROVAL") {
    throw new Error("대기 중인 요청만 반려할 수 있습니다.");
  }

  const nextSchema: FormSchema = {
    ...(block.form_schema as FormSchema),
    origin: "manual_new",
    request_status: "REJECTED",
    reviewed_by: user.id,
    reviewed_at: ts,
    reject_reason: rejectReason,
  };
  const { error: uErr } = await admin
    .from("content_blocks")
    .update({
      form_schema: nextSchema,
      is_active: false,
      updated_at: ts,
    })
    .eq("id", blockId);
  if (uErr) throw new Error(uErr.message);

  await writeAuditLog({
    action: "UPDATE",
    entity_type: "content_blocks",
    entity_id: blockId,
    before_data: { request_status: "PENDING_APPROVAL" },
    after_data: { request_status: "REJECTED", reject_reason: rejectReason },
  });

  return { blockId, code: (block as ContentBlock).code };
}

/** Contributor may only see their department; approvers see all pending. */
export function canSeeNewContentRequest(
  user: { role: string; department: string | null },
  block: Pick<ContentBlock, "owner_department">,
) {
  if (user.role === "ADMIN" || user.role === "REVIEWER") return true;
  if (user.role === "CONTRIBUTOR") {
    return sameDepartment(user.department, block.owner_department);
  }
  return false;
}
