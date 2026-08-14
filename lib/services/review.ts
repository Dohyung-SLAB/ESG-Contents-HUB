import { newId, touch } from "@/lib/data/ids";
import {
  getCurrentUser as getPilotCurrentUser,
  getPilotStore,
} from "@/lib/data/pilot-store";
import { getSessionUser } from "@/lib/data/session";
import { writeAuditLog } from "@/lib/services/audit";
import { getBlockDetail } from "@/lib/services/library";
import { assertTransition } from "@/lib/services/update";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ContentStatus, ReviewAction } from "@/types/enums";

const QUEUE_STATUSES: ContentStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "REVISION_REQUESTED",
];

export async function listReviewQueue(
  filters: {
    issue?: string;
    owner?: string;
    content_type?: string;
    status?: ContentStatus | "";
    change_type?: string;
  } = {},
) {
  if (!isSupabaseConfigured()) {
    return listReviewQueuePilot(filters);
  }

  const admin = createSupabaseAdminClient();
  const { data: versions, error } = await admin
    .from("content_versions")
    .select("*")
    .eq("reporting_year", 2027)
    .in("status", QUEUE_STATUSES);
  if (error) throw new Error(error.message);

  const blockIds = [...new Set((versions ?? []).map((v) => v.content_block_id))];
  const [{ data: blocks }, { data: issues }, { data: profiles }] =
    await Promise.all([
      blockIds.length
        ? admin.from("content_blocks").select("*").in("id", blockIds)
        : Promise.resolve({ data: [] }),
      admin.from("issues").select("*"),
      admin.from("profiles").select("*"),
    ]);

  const blockMap = new Map((blocks ?? []).map((b) => [b.id, b]));
  const issueMap = new Map((issues ?? []).map((i) => [i.id, i]));
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const rows = (versions ?? []).map((version) => {
    const block = blockMap.get(version.content_block_id)!;
    const issue = issueMap.get(block.issue_id);
    const owner = block.owner_user_id
      ? profileMap.get(block.owner_user_id)
      : null;
    return { version, block, issue, owner_name: owner?.full_name ?? null };
  });

  return rows.filter((row) => {
    if (filters.issue && row.issue?.name !== filters.issue) return false;
    if (
      filters.owner &&
      !row.owner_name?.toLowerCase().includes(filters.owner.toLowerCase())
    ) {
      return false;
    }
    if (filters.content_type && row.block.content_type !== filters.content_type) {
      return false;
    }
    if (filters.status && row.version.status !== filters.status) return false;
    if (filters.change_type && row.version.change_type !== filters.change_type) {
      return false;
    }
    return true;
  });
}

function listReviewQueuePilot(filters: {
  issue?: string;
  owner?: string;
  content_type?: string;
  status?: ContentStatus | "";
  change_type?: string;
}) {
  const store = getPilotStore();
  const rows = store.content_versions
    .filter(
      (v) => v.reporting_year === 2027 && QUEUE_STATUSES.includes(v.status),
    )
    .map((version) => {
      const block = store.content_blocks.find(
        (b) => b.id === version.content_block_id,
      )!;
      const issue = store.issues.find((i) => i.id === block.issue_id);
      const owner = store.profiles.find((p) => p.id === block.owner_user_id);
      return { version, block, issue, owner_name: owner?.full_name ?? null };
    });
  return rows.filter((row) => {
    if (filters.issue && row.issue?.name !== filters.issue) return false;
    if (
      filters.owner &&
      !row.owner_name?.toLowerCase().includes(filters.owner.toLowerCase())
    ) {
      return false;
    }
    if (filters.content_type && row.block.content_type !== filters.content_type) {
      return false;
    }
    if (filters.status && row.version.status !== filters.status) return false;
    if (filters.change_type && row.version.change_type !== filters.change_type) {
      return false;
    }
    return true;
  });
}

export async function getReviewDetail(blockId: string) {
  const detail = await getBlockDetail(blockId);
  if (!detail) return null;

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const reviews = detail.current
      ? store.reviews
          .filter((r) => r.content_version_id === detail.current!.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      : [];
    return { ...detail, reviews };
  }

  if (!detail.current) return { ...detail, reviews: [] };
  const admin = createSupabaseAdminClient();
  const { data: reviews } = await admin
    .from("reviews")
    .select("*")
    .eq("content_version_id", detail.current.id)
    .order("created_at", { ascending: false });
  return { ...detail, reviews: reviews ?? [] };
}

export async function performReviewAction(input: {
  blockId: string;
  action: ReviewAction;
  comment?: string;
}) {
  if (!isSupabaseConfigured()) {
    return performReviewActionPilot(input);
  }

  const user = await getSessionUser();
  if (user.role === "CONTRIBUTOR") {
    throw new Error("Contributor는 리뷰 액션을 수행할 수 없습니다.");
  }

  const detail = await getBlockDetail(input.blockId);
  if (!detail?.current) throw new Error("버전을 찾을 수 없습니다.");

  const admin = createSupabaseAdminClient();
  const version = detail.current;
  const before = { ...version };
  const ts = touch();
  const patch: Record<string, unknown> = {
    updated_at: ts,
    updated_by: user.id,
  };

  if (input.action === "START_REVIEW") {
    assertTransition(version.status, "UNDER_REVIEW");
    patch.status = "UNDER_REVIEW";
  } else if (input.action === "APPROVE") {
    assertTransition(version.status, "APPROVED");
    patch.status = "APPROVED";
    patch.approved_by = user.id;
    patch.approved_at = ts;
  } else if (input.action === "REQUEST_REVISION") {
    assertTransition(version.status, "REVISION_REQUESTED");
    patch.status = "REVISION_REQUESTED";
  }

  if (input.action !== "COMMENT") {
    const { error } = await admin
      .from("content_versions")
      .update(patch)
      .eq("id", version.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin
      .from("content_versions")
      .update({ updated_at: ts, updated_by: user.id })
      .eq("id", version.id);
    if (error) throw new Error(error.message);
  }

  const review = {
    id: newId(),
    content_version_id: version.id,
    reviewer_id: user.id,
    action: input.action,
    comment: input.comment ?? null,
    created_at: ts,
  };
  const { error: rErr } = await admin.from("reviews").insert(review);
  if (rErr) throw new Error(rErr.message);

  const auditAction =
    input.action === "APPROVE"
      ? "APPROVE"
      : input.action === "REQUEST_REVISION"
        ? "REQUEST_REVISION"
        : "UPDATE";

  await writeAuditLog({
    action: auditAction,
    entity_type: "content_versions",
    entity_id: version.id,
    before_data: before,
    after_data: { ...version, ...patch, review },
  });

  return getReviewDetail(input.blockId);
}

function performReviewActionPilot(input: {
  blockId: string;
  action: ReviewAction;
  comment?: string;
}) {
  const store = getPilotStore();
  const user = getPilotCurrentUser();
  if (user.role === "CONTRIBUTOR") {
    throw new Error("Contributor는 리뷰 액션을 수행할 수 없습니다.");
  }
  const block =
    store.content_blocks.find(
      (b) => b.id === input.blockId || b.code === input.blockId,
    ) ?? null;
  if (!block) throw new Error("버전을 찾을 수 없습니다.");
  const version = store.content_versions.find(
    (v) => v.content_block_id === block.id && v.reporting_year === 2027,
  );
  if (!version) throw new Error("버전을 찾을 수 없습니다.");
  const before = { ...version };
  const ts = touch();
  if (input.action === "START_REVIEW") {
    assertTransition(version.status, "UNDER_REVIEW");
    version.status = "UNDER_REVIEW";
  } else if (input.action === "APPROVE") {
    assertTransition(version.status, "APPROVED");
    version.status = "APPROVED";
    version.approved_by = user.id;
    version.approved_at = ts;
  } else if (input.action === "REQUEST_REVISION") {
    assertTransition(version.status, "REVISION_REQUESTED");
    version.status = "REVISION_REQUESTED";
  }
  version.updated_at = ts;
  version.updated_by = user.id;
  const review = {
    id: newId(),
    content_version_id: version.id,
    reviewer_id: user.id,
    action: input.action,
    comment: input.comment ?? null,
    created_at: ts,
  };
  store.reviews.push(review);
  void writeAuditLog({
    action:
      input.action === "APPROVE"
        ? "APPROVE"
        : input.action === "REQUEST_REVISION"
          ? "REQUEST_REVISION"
          : "UPDATE",
    entity_type: "content_versions",
    entity_id: version.id,
    before_data: before,
    after_data: { ...version, review },
  });
  return getReviewDetail(input.blockId);
}
