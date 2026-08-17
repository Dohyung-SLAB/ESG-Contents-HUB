import { newId, touch } from "@/lib/data/ids";
import {
  getCurrentUser as getPilotCurrentUser,
  getPilotStore,
} from "@/lib/data/pilot-store";
import { getSessionUser } from "@/lib/data/session";
import { writeAuditLog } from "@/lib/services/audit";
import { getBlockDetail, resolveBlockId } from "@/lib/services/library";
import { canEditContentBlock } from "@/lib/services/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { KeyFact } from "@/types/database";
import type { ChangeType, ContentStatus } from "@/types/enums";

const ALLOWED: Record<ContentStatus, ContentStatus[]> = {
  NOT_STARTED: ["IN_PROGRESS", "SUBMITTED"],
  IN_PROGRESS: ["IN_PROGRESS", "SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "REVISION_REQUESTED"],
  REVISION_REQUESTED: ["IN_PROGRESS", "SUBMITTED"],
  APPROVED: [],
  ARCHIVED: [],
};

export function assertTransition(from: ContentStatus, to: ContentStatus): void {
  if (from === to && from === "IN_PROGRESS") return;
  if (!ALLOWED[from]?.includes(to)) {
    throw new Error(`허용되지 않은 상태 전환입니다: ${from} → ${to}`);
  }
}

export type UpdateDraftInput = {
  blockId: string;
  change_type: ChangeType;
  narrative?: string | null;
  change_summary?: string | null;
  key_facts?: Array<{
    key: string;
    value_text?: string | null;
    value_number?: number | null;
    unit?: string | null;
    value_type: KeyFact["value_type"];
    display_order?: number;
  }>;
  submit?: boolean;
};

export async function saveAnnualUpdateDraft(input: UpdateDraftInput) {
  if (!isSupabaseConfigured()) {
    return saveAnnualUpdateDraftPilot(input);
  }

  const user = await getSessionUser();
  const blockId = await resolveBlockId(input.blockId);
  if (!blockId) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");

  const detail = await getBlockDetail(blockId);
  if (!detail?.current) {
    throw new Error("현재 보고연도 버전을 찾을 수 없습니다.");
  }
  if (!canEditContentBlock(user, detail.block)) {
    throw new Error(
      user.role === "CONTRIBUTOR"
        ? "자기 부서에 지정된 컨텐츠만 수정할 수 있습니다."
        : "현재 역할로는 업데이트를 저장할 수 없습니다.",
    );
  }

  const admin = createSupabaseAdminClient();
  const version = detail.current;
  const before = { ...version };

  let nextStatus = version.status;
  if (input.submit) {
    // One-click submit from draft states → Review queue
    if (
      version.status === "NOT_STARTED" ||
      version.status === "IN_PROGRESS" ||
      version.status === "REVISION_REQUESTED"
    ) {
      assertTransition(version.status, "SUBMITTED");
      nextStatus = "SUBMITTED";
    } else if (version.status === "SUBMITTED") {
      // already submitted — keep
      nextStatus = "SUBMITTED";
    } else {
      throw new Error(
        `현재 상태(${version.status})에서는 제출할 수 없습니다.`,
      );
    }
  } else if (version.status === "NOT_STARTED") {
    assertTransition(version.status, "IN_PROGRESS");
    nextStatus = "IN_PROGRESS";
  } else if (version.status === "REVISION_REQUESTED") {
    assertTransition(version.status, "IN_PROGRESS");
    nextStatus = "IN_PROGRESS";
  } else if (version.status === "IN_PROGRESS") {
    // stay
  } else {
    throw new Error(
      `현재 상태(${version.status})에서는 초안을 저장할 수 없습니다.`,
    );
  }

  const ts = touch();
  const patch = {
    change_type: input.change_type,
    status: nextStatus,
    updated_by: user.id,
    updated_at: ts,
    created_by: version.created_by ?? user.id,
    ...(input.narrative !== undefined ? { narrative: input.narrative } : {}),
    ...(input.change_summary !== undefined
      ? { change_summary: input.change_summary }
      : {}),
  };

  const { error: vErr } = await admin
    .from("content_versions")
    .update(patch)
    .eq("id", version.id);
  if (vErr) throw new Error(vErr.message);

  if (input.key_facts) {
    await admin.from("key_facts").delete().eq("content_version_id", version.id);
    const rows = input.key_facts.map((fact, idx) => ({
      id: newId(),
      content_version_id: version.id,
      key: fact.key,
      value_text: fact.value_text ?? null,
      value_number: fact.value_number ?? null,
      unit: fact.unit ?? null,
      value_type: fact.value_type,
      display_order: fact.display_order ?? idx + 1,
      created_at: ts,
      updated_at: ts,
    }));
    if (rows.length) {
      const { error: kfErr } = await admin.from("key_facts").insert(rows);
      if (kfErr) throw new Error(kfErr.message);
    }
  }

  await writeAuditLog({
    action: input.submit ? "SUBMIT" : "UPDATE",
    entity_type: "content_versions",
    entity_id: version.id,
    before_data: before,
    after_data: { ...version, ...patch },
  });

  return getBlockDetail(blockId);
}

function saveAnnualUpdateDraftPilot(input: UpdateDraftInput) {
  const store = getPilotStore();
  const user = getPilotCurrentUser();
  const block =
    store.content_blocks.find(
      (b) => b.id === input.blockId || b.code === input.blockId,
    ) ?? null;
  if (!block) throw new Error("콘텐츠 블록을 찾을 수 없습니다.");
  if (!canEditContentBlock(user, block)) {
    throw new Error(
      user.role === "CONTRIBUTOR"
        ? "자기 부서에 지정된 컨텐츠만 수정할 수 있습니다."
        : "현재 역할로는 업데이트를 저장할 수 없습니다.",
    );
  }
  const reportingYear = store.active_project_id
    ? (store.projects.find((p) => p.id === store.active_project_id)
        ?.reporting_year ?? 2027)
    : 2027;
  const version = store.content_versions.find(
    (v) =>
      v.content_block_id === block.id && v.reporting_year === reportingYear,
  );
  if (!version) {
    throw new Error(`현재 보고연도(${reportingYear}) 버전을 찾을 수 없습니다.`);
  }
  const before = { ...version };
  let nextStatus = version.status;
  if (input.submit) {
    if (
      version.status === "NOT_STARTED" ||
      version.status === "IN_PROGRESS" ||
      version.status === "REVISION_REQUESTED"
    ) {
      assertTransition(version.status, "SUBMITTED");
      nextStatus = "SUBMITTED";
    } else if (version.status === "SUBMITTED") {
      nextStatus = "SUBMITTED";
    } else {
      throw new Error(
        `현재 상태(${version.status})에서는 제출할 수 없습니다.`,
      );
    }
  } else if (version.status === "NOT_STARTED") {
    assertTransition(version.status, "IN_PROGRESS");
    nextStatus = "IN_PROGRESS";
  } else if (version.status === "REVISION_REQUESTED") {
    assertTransition(version.status, "IN_PROGRESS");
    nextStatus = "IN_PROGRESS";
  } else if (version.status !== "IN_PROGRESS") {
    throw new Error(
      `현재 상태(${version.status})에서는 초안을 저장할 수 없습니다.`,
    );
  }
  const ts = touch();
  version.change_type = input.change_type;
  if (input.narrative !== undefined) version.narrative = input.narrative;
  if (input.change_summary !== undefined) {
    version.change_summary = input.change_summary;
  }
  version.status = nextStatus;
  version.updated_by = user.id;
  version.updated_at = ts;
  if (!version.created_by) version.created_by = user.id;
  if (input.key_facts) {
    store.key_facts = store.key_facts.filter(
      (k) => k.content_version_id !== version.id,
    );
    input.key_facts.forEach((fact, idx) => {
      store.key_facts.push({
        id: newId(),
        content_version_id: version.id,
        key: fact.key,
        value_text: fact.value_text ?? null,
        value_number: fact.value_number ?? null,
        unit: fact.unit ?? null,
        value_type: fact.value_type,
        display_order: fact.display_order ?? idx + 1,
        created_at: ts,
        updated_at: ts,
      });
    });
  }
  void writeAuditLog({
    action: input.submit ? "SUBMIT" : "UPDATE",
    entity_type: "content_versions",
    entity_id: version.id,
    before_data: before,
    after_data: { ...version },
  });
  return getBlockDetail(block.id);
}
