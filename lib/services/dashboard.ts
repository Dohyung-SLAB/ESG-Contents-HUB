import { getPilotStore } from "@/lib/data/pilot-store";
import { getActiveWorkspace, listIssuesForActiveProject } from "@/lib/services/projects";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ChangeType, ContentStatus } from "@/types/enums";

export async function getDashboardMetrics() {
  const { project } = await getActiveWorkspace();
  const issues = await listIssuesForActiveProject();
  const issueIds = issues.map((i) => i.id);
  const reportingYear = project.reporting_year;

  if (!isSupabaseConfigured()) {
    return getDashboardMetricsPilot(issueIds, reportingYear);
  }

  if (issueIds.length === 0) {
    return computeMetrics([], [], new Set());
  }

  const admin = createSupabaseAdminClient();
  const [{ data: blocks }, { data: versions }, { data: links }] =
    await Promise.all([
      admin
        .from("content_blocks")
        .select("*")
        .in("issue_id", issueIds)
        .eq("is_active", true),
      admin
        .from("content_versions")
        .select("*")
        .eq("reporting_year", reportingYear),
      admin.from("content_evidences").select("content_version_id"),
    ]);

  const blockList = blocks ?? [];
  const versionMap = new Map(
    (versions ?? []).map((v) => [v.content_block_id, v]),
  );
  const versionRows = blockList.map((b) => versionMap.get(b.id));
  const linkedVersions = new Set(
    (links ?? []).map((l) => l.content_version_id),
  );

  return computeMetrics(blockList, versionRows, linkedVersions);
}

function getDashboardMetricsPilot(issueIds: string[], reportingYear: number) {
  const store = getPilotStore();
  const blocks = store.content_blocks.filter(
    (b) => issueIds.includes(b.issue_id) && b.is_active,
  );
  const versions = blocks.map((b) =>
    store.content_versions.find(
      (v) => v.content_block_id === b.id && v.reporting_year === reportingYear,
    ),
  );
  const linkedVersions = new Set(
    store.content_evidences.map((ce) => ce.content_version_id),
  );
  return computeMetrics(blocks, versions, linkedVersions);
}

function computeMetrics(
  blocks: Array<{
    id: string;
    code: string;
    title?: string;
    section?: string | null;
    sub_topic: string | null;
    reviewer_user_id: string | null;
  }>,
  versions: Array<
    | {
        id: string;
        status: ContentStatus;
        change_type: ChangeType;
      }
    | undefined
  >,
  linkedVersions: Set<string>,
) {
  const statusCount = (status: ContentStatus) =>
    versions.filter((v) => v?.status === status).length;
  const changeCount = (change: ChangeType) =>
    versions.filter((v) => v?.change_type === change).length;

  const total = blocks.length;
  const notStarted = statusCount("NOT_STARTED");
  const inProgress = statusCount("IN_PROGRESS");
  const submitted = statusCount("SUBMITTED");
  const underReview = statusCount("UNDER_REVIEW");
  const revision = statusCount("REVISION_REQUESTED");
  const approved = statusCount("APPROVED");

  const submissionRate =
    total === 0
      ? 0
      : ((submitted + underReview + revision + approved) / total) * 100;
  const reviewCompletionRate =
    submitted + underReview + revision + approved === 0
      ? 0
      : (approved / (submitted + underReview + revision + approved)) * 100;
  const approvalRate = total === 0 ? 0 : (approved / total) * 100;

  const actionRequired = {
    not_started: blocks.filter((_, i) => versions[i]?.status === "NOT_STARTED"),
    awaiting_submit: blocks.filter(
      (_, i) => versions[i]?.status === "IN_PROGRESS",
    ),
    revision_requested: blocks.filter(
      (_, i) => versions[i]?.status === "REVISION_REQUESTED",
    ),
    no_evidence: blocks.filter((_, i) => {
      const v = versions[i];
      if (!v || v.status === "NOT_STARTED") return false;
      return !linkedVersions.has(v.id);
    }),
    no_reviewer: blocks.filter((b) => !b.reviewer_user_id),
  };

  // Progress by actual Extraction TOC section (content_blocks.section), not legacy buckets.
  const sectionOrder: string[] = [];
  const sectionIdx = new Map<string, number[]>();
  blocks.forEach((b, i) => {
    const label = (b.section ?? "").trim() || "기타";
    if (!sectionIdx.has(label)) {
      sectionIdx.set(label, []);
      sectionOrder.push(label);
    }
    sectionIdx.get(label)!.push(i);
  });

  const sectionProgress = sectionOrder.map((section) => {
    const idxs = sectionIdx.get(section) ?? [];
    const done = idxs.filter((i) => versions[i]?.status === "APPROVED").length;
    return {
      section,
      total: idxs.length,
      approved: done,
      rate: idxs.length === 0 ? 0 : (done / idxs.length) * 100,
    };
  });

  return {
    kpis: {
      total,
      notStarted,
      inProgress,
      submitted,
      underReview,
      revision,
      approved,
    },
    changes: {
      pending: changeCount("PENDING"),
      noChange: changeCount("NO_CHANGE"),
      modified: changeCount("MODIFIED"),
      new: changeCount("NEW"),
      deleted: changeCount("DELETED"),
    },
    rates: {
      submissionRate,
      reviewCompletionRate,
      approvalRate,
    },
    actionRequired,
    sectionProgress,
  };
}
