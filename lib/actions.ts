"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getSessionUser, setSessionRole } from "@/lib/data/session";
import {
  applySuggestion,
  generateChangeSummary,
  generateEvidenceCheck,
  generateNarrativeUpdate,
  rejectSuggestion,
  updateSuggestionPayload,
} from "@/lib/services/ai";
import { signIn, signOut, signUp } from "@/lib/services/auth";
import {
  deleteEvidence,
  linkEvidence,
  unlinkEvidence,
  uploadEvidence,
} from "@/lib/services/evidence";
import {
  approveCandidate,
  approveCandidates,
  createExtractionJobFromUpload,
  deleteCandidate,
  mergeCandidates,
  splitCandidate,
  updateCandidate,
} from "@/lib/services/extraction";
import {
  isAwaitingAssignment,
  removeProjectMember,
} from "@/lib/services/members";
import {
  createProjectInvite,
  revokeProjectInvite,
} from "@/lib/services/invites";
import { performReviewAction } from "@/lib/services/review";
import {
  assignOwnerDepartment,
  createCompanyAndProject,
  createProjectForCompany,
  deleteCompany,
  deleteProject,
  switchActiveProject,
} from "@/lib/services/projects";
import {
  updateContentBlockFields,
  updateContentBlockFrameworks,
} from "@/lib/services/library";
import { saveAnnualUpdateDraft } from "@/lib/services/update";
import {
  approveNewContentRequest,
  createNewContentRequest,
  rejectNewContentRequest,
} from "@/lib/services/new-content";
import {
  DISCLOSURE_FRAMEWORKS,
  ESG_EVAL_FRAMEWORKS,
  normalizeFrameworkList,
} from "@/lib/frameworks";
import type { ChangeType, ReviewAction, UserRole } from "@/types/enums";
import type { ContentType, EvidenceRelationshipType, UpdateType } from "@/types/enums";

export async function actionSignUp(input: {
  email: string;
  password: string;
  full_name: string;
  department?: string | null;
}) {
  try {
    const { profile } = await signUp(input);
    revalidatePath("/", "layout");
    const waiting = await isAwaitingAssignment(profile);
    return {
      ok: true as const,
      redirectTo: waiting ? "/waiting" : "/dashboard",
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "가입 실패",
    };
  }
}

export async function actionSignIn(input: {
  email: string;
  password: string;
}) {
  try {
    const { profile } = await signIn(input);
    revalidatePath("/", "layout");
    const waiting = await isAwaitingAssignment(profile);
    return {
      ok: true as const,
      redirectTo: waiting ? "/waiting" : "/dashboard",
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "로그인 실패",
    };
  }
}

export async function actionSignOut() {
  await signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function actionAssignProjectMember(input: {
  projectId: string;
  email: string;
  memberRole: "CONTRIBUTOR" | "REVIEWER" | "ADMIN";
  department?: string | null;
}) {
  try {
    if (input.memberRole === "ADMIN") {
      throw new Error("고객사 담당자는 CONTRIBUTOR 또는 REVIEWER로만 초대합니다.");
    }
    // Prefer invite-first flow (works before the client has signed up)
    const invite = await createProjectInvite({
      projectId: input.projectId,
      email: input.email,
      memberRole: input.memberRole,
      department: input.department,
    });
    revalidatePath("/settings");
    revalidatePath("/", "layout");
    return { ok: true as const, result: invite };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "초대 실패",
    };
  }
}

export async function actionRevokeProjectInvite(inviteId: string, email: string) {
  try {
    await revokeProjectInvite(inviteId, email);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "초대 취소 실패",
    };
  }
}

export async function actionRemoveProjectMember(
  projectId: string,
  profileId: string,
) {
  await removeProjectMember(projectId, profileId);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function actionSetRole(role: UserRole) {
  try {
    await setSessionRole(role);
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "역할 전환 실패",
    };
  }
}

export async function actionSwitchProject(projectId: string) {
  await switchActiveProject(projectId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function actionAssignOwnerDepartment(input: {
  blockId: string;
  owner_department: string;
}) {
  const result = await assignOwnerDepartment(input);
  revalidatePath("/library");
  revalidatePath(`/update/${input.blockId}`);
  revalidatePath("/dashboard");
  return result;
}

export async function actionCreateCompanyAndProject(input: {
  company_name: string;
  project_name: string;
  reporting_year: number;
  base_year?: number | null;
  brand_primary?: string | null;
}) {
  const result = await createCompanyAndProject(input);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return result;
}

export async function actionCreateProjectForCompany(input: {
  company_id: string;
  project_name: string;
  reporting_year: number;
  base_year?: number | null;
}) {
  const result = await createProjectForCompany(input);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return result;
}

export async function actionDeleteProject(projectId: string) {
  const result = await deleteProject(projectId);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/library");
  revalidatePath("/extraction");
  revalidatePath("/report-draft");
  return result;
}

export async function actionDeleteCompany(companyId: string) {
  const result = await deleteCompany(companyId);
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/library");
  revalidatePath("/extraction");
  revalidatePath("/report-draft");
  revalidatePath("/evidence");
  return result;
}

export async function actionSaveDraft(input: {
  blockId: string;
  change_type: ChangeType;
  narrative?: string | null;
  change_summary?: string | null;
  key_facts?: Array<{
    key: string;
    value_text?: string | null;
    value_number?: number | null;
    unit?: string | null;
    value_type: "TEXT" | "NUMBER" | "FREQUENCY" | "PERCENT" | "SCORE";
    display_order?: number;
  }>;
  submit?: boolean;
}) {
  const result = await saveAnnualUpdateDraft(input);
  revalidatePath(`/update/${input.blockId}`);
  revalidatePath("/library");
  revalidatePath("/review");
  revalidatePath("/dashboard");
  return result;
}

export async function actionCreateNewContentRequest(input: {
  title: string;
  section: string;
  sub_topic?: string | null;
  content_type: ContentType;
  update_type: UpdateType;
  owner_department?: string | null;
  request_note?: string | null;
  issue_id?: string | null;
}) {
  const result = await createNewContentRequest(input);
  revalidatePath("/update");
  revalidatePath("/library");
  revalidatePath("/dashboard");
  revalidatePath(`/update/${result.code}`);
  return result;
}

export async function actionApproveNewContentRequest(blockId: string) {
  const result = await approveNewContentRequest(blockId);
  revalidatePath("/update");
  revalidatePath("/library");
  revalidatePath("/dashboard");
  revalidatePath(`/update/${result.code}`);
  return result;
}

export async function actionRejectNewContentRequest(
  blockId: string,
  reason?: string | null,
) {
  const result = await rejectNewContentRequest(blockId, reason);
  revalidatePath("/update");
  revalidatePath("/library");
  revalidatePath("/dashboard");
  return result;
}

export async function actionUploadEvidence(input: {
  filename: string;
  content_version_id: string;
  relationship_type?: EvidenceRelationshipType;
  document_type?: string;
  storage_path?: string;
  evidence_id?: string;
}) {
  const result = await uploadEvidence(input);
  revalidatePath("/evidence");
  revalidatePath("/library");
  revalidatePath("/update", "layout");
  return result;
}

export async function actionUnlinkEvidence(id: string) {
  const result = await unlinkEvidence(id);
  revalidatePath("/evidence");
  return result;
}

export async function actionDeleteEvidence(id: string) {
  const result = await deleteEvidence(id);
  revalidatePath("/evidence");
  return result;
}

export async function actionLinkEvidence(input: {
  evidence_id: string;
  content_version_id: string;
  relationship_type?: EvidenceRelationshipType;
}) {
  const result = await linkEvidence(input);
  revalidatePath("/evidence");
  return result;
}

export async function actionReview(input: {
  blockId: string;
  action: ReviewAction;
  comment?: string;
}) {
  const result = await performReviewAction(input);
  revalidatePath("/review");
  revalidatePath("/library");
  revalidatePath("/dashboard");
  return result;
}

export async function actionGenerateChangeSummary(blockId: string) {
  const result = await generateChangeSummary(blockId);
  revalidatePath(`/update/${blockId}`);
  return result;
}

export async function actionGenerateNarrative(
  blockId: string,
  changeMemo?: string,
) {
  const user = await getSessionUser();
  if (user.role !== "ADMIN") {
    throw new Error("AI 서술 개정은 컨설턴트(ADMIN)만 사용할 수 있습니다.");
  }
  const result = await generateNarrativeUpdate(blockId, {
    changeMemo,
    apply: true,
  });
  revalidatePath(`/update/${blockId}`);
  revalidatePath("/library");
  revalidatePath("/report-draft");
  return result;
}

export async function actionGenerateEvidenceCheck(blockId: string) {
  const result = await generateEvidenceCheck(blockId);
  revalidatePath(`/update/${blockId}`);
  revalidatePath("/review");
  return result;
}

export async function actionApplySuggestion(id: string, blockId: string) {
  const result = await applySuggestion(id);
  revalidatePath(`/update/${blockId}`);
  return result;
}

export async function actionRejectSuggestion(id: string, blockId: string) {
  const result = await rejectSuggestion(id);
  revalidatePath(`/update/${blockId}`);
  return result;
}

export async function actionEditSuggestion(
  id: string,
  blockId: string,
  payload: Record<string, unknown>,
) {
  const result = await updateSuggestionPayload(id, payload);
  revalidatePath(`/update/${blockId}`);
  return result;
}

export async function actionCreateExtraction(input: {
  filename: string;
  toc_section: string;
  storage_path: string;
}) {
  const result = await createExtractionJobFromUpload(input);
  revalidatePath("/extraction");
  return result;
}

export async function actionApproveCandidate(candidateId: string, jobId: string) {
  const result = await approveCandidate(candidateId);
  revalidatePath(`/extraction/${jobId}`);
  revalidatePath("/library");
  return result;
}

export async function actionApproveCandidates(
  candidateIds: string[],
  jobId: string,
) {
  const result = await approveCandidates(candidateIds);
  revalidatePath(`/extraction/${jobId}`);
  revalidatePath("/library");
  return result;
}

export async function actionMergeCandidates(ids: string[], jobId: string) {
  const result = await mergeCandidates(ids);
  revalidatePath(`/extraction/${jobId}`);
  return result;
}

export async function actionSplitCandidate(
  id: string,
  titles: string[],
  jobId: string,
) {
  const result = await splitCandidate(id, titles);
  revalidatePath(`/extraction/${jobId}`);
  return result;
}

export async function actionUpdateCandidate(
  id: string,
  patch: Partial<{
    title: string;
    content_type: ContentType;
    update_type: UpdateType;
    narrative: string;
    esg_frameworks: string[];
    disclosure_frameworks: string[];
  }>,
  jobId: string,
) {
  const result = await updateCandidate(id, patch);
  revalidatePath(`/extraction/${jobId}`);
  return result;
}

export async function actionUpdateBlockFrameworks(
  blockId: string,
  patch: {
    esg_frameworks: string[];
    disclosure_frameworks: string[];
  },
) {
  const result = await updateContentBlockFrameworks(blockId, {
    esg_frameworks: normalizeFrameworkList(
      patch.esg_frameworks,
      ESG_EVAL_FRAMEWORKS,
    ),
    disclosure_frameworks: normalizeFrameworkList(
      patch.disclosure_frameworks,
      DISCLOSURE_FRAMEWORKS,
    ),
  });
  revalidatePath("/library");
  revalidatePath("/review");
  revalidatePath("/report-draft");
  revalidatePath(`/update/${result.code}`);
  revalidatePath("/update");
  return result;
}

/** Consultant-only: correct Extraction TOC section / sub_topic on a library block. */
export async function actionUpdateBlockSection(
  blockId: string,
  patch: { section: string; sub_topic?: string | null },
) {
  const user = await getSessionUser();
  if (user.role !== "ADMIN") {
    throw new Error("Section 수정은 컨설턴트(ADMIN)만 할 수 있습니다.");
  }
  const result = await updateContentBlockFields(blockId, {
    section: patch.section,
    sub_topic: patch.sub_topic,
  });
  revalidatePath("/library");
  revalidatePath("/dashboard");
  revalidatePath("/report-draft");
  revalidatePath("/review");
  revalidatePath(`/update/${result.code}`);
  return result;
}

export async function actionDeleteCandidate(id: string, jobId: string) {
  await deleteCandidate(id);
  revalidatePath(`/extraction/${jobId}`);
  return { ok: true };
}
