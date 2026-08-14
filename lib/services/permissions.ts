import type { ContentBlock, Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";

/** Product meaning of roles (demo + future auth). */
export const ROLE_GUIDE: Record<
  UserRole,
  { labelKo: string; summary: string; can: string[] }
> = {
  ADMIN: {
    labelKo: "관리자 (컨설턴트)",
    summary:
      "1개 이상 고객사를 담당하는 컨설턴트. 고객사·프로젝트를 만들고, 컨텐츠별 작성 부서를 지정합니다.",
    can: [
      "고객사/프로젝트 생성·삭제",
      "컨텐츠 작성 부서 지정",
      "전체 컨텐츠 조회·수정 지원",
      "리뷰 승인/반려",
      "Evidence 삭제",
    ],
  },
  REVIEWER: {
    labelKo: "Reviewer (고객사 ESG 담당)",
    summary:
      "해당 고객사 ESG팀 책임/담당자. 작성 부서를 지정하고, 제출된 컨텐츠를 검토·승인합니다.",
    can: [
      "컨텐츠 작성 부서 지정",
      "리뷰 시작/승인/수정요청",
      "전체 컨텐츠 조회",
      "컨텐츠 본문 직접 수정 불가",
    ],
  },
  CONTRIBUTOR: {
    labelKo: "Contributor (현업 부서)",
    summary:
      "컨텐츠를 작성하는 현업 부서. 자기 부서에 지정된 컨텐츠만 수정·제출할 수 있습니다.",
    can: [
      "지정된 부서 컨텐츠만 조회·수정",
      "Annual Update 저장/제출",
      "Evidence 업로드·연결",
      "리뷰 액션 불가",
    ],
  },
};

/** Pilot departments used for assignment dropdowns. */
export const PILOT_DEPARTMENTS = [
  "ESG",
  "품질보증",
  "생산",
  "마케팅",
  "고객센터",
  "법무",
] as const;

function normDept(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function sameDepartment(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  const left = normDept(a);
  const right = normDept(b);
  if (!left || !right) return false;
  return left === right;
}

export function canCreateProject(role: UserRole) {
  return role === "ADMIN";
}

export function canDeleteProject(role: UserRole) {
  return role === "ADMIN";
}

export function canAssignOwnerDepartment(role: UserRole) {
  return role === "ADMIN" || role === "REVIEWER";
}

export function canReview(role: UserRole) {
  return role === "ADMIN" || role === "REVIEWER";
}

export function canDeleteEvidence(role: UserRole) {
  return role === "ADMIN";
}

export function canManageExtraction(role: UserRole) {
  return role === "ADMIN";
}

/** Role-level edit capability (before block scope). */
export function canEditContent(role: UserRole) {
  return role === "ADMIN" || role === "CONTRIBUTOR";
}

export type NavItemKey =
  | "dashboard"
  | "library"
  | "update"
  | "review"
  | "evidence"
  | "extraction"
  | "report-draft"
  | "settings";

/** Sidebar visibility by role. Clients never see Extraction / Report Draft tools. */
export function canAccessNav(role: UserRole, item: NavItemKey): boolean {
  switch (item) {
    case "dashboard":
    case "library":
    case "evidence":
    case "settings":
      return true;
    case "update":
      return role === "ADMIN" || role === "CONTRIBUTOR";
    case "review":
      return role === "ADMIN" || role === "REVIEWER";
    case "extraction":
    case "report-draft":
      return role === "ADMIN";
    default:
      return false;
  }
}

export function allowedNavHrefs(role: UserRole): string[] {
  const all: Array<{ href: string; key: NavItemKey }> = [
    { href: "/dashboard", key: "dashboard" },
    { href: "/library", key: "library" },
    { href: "/update", key: "update" },
    { href: "/review", key: "review" },
    { href: "/evidence", key: "evidence" },
    { href: "/extraction", key: "extraction" },
    { href: "/report-draft", key: "report-draft" },
    { href: "/settings", key: "settings" },
  ];
  return all.filter((i) => canAccessNav(role, i.key)).map((i) => i.href);
}

/**
 * Block-level edit: Contributor only if owner_department matches profile.department.
 * Admin may edit any block (consultant support). Reviewer cannot edit body.
 */
export function canEditContentBlock(
  user: Pick<Profile, "role" | "department">,
  block: Pick<ContentBlock, "owner_department">,
) {
  if (user.role === "ADMIN") return true;
  if (user.role === "REVIEWER") return false;
  if (user.role === "CONTRIBUTOR") {
    return sameDepartment(user.department, block.owner_department);
  }
  return false;
}

/** Library visibility for Contributor: only blocks assigned to their department. */
export function canViewContentBlock(
  user: Pick<Profile, "role" | "department">,
  block: Pick<ContentBlock, "owner_department">,
) {
  if (user.role === "ADMIN" || user.role === "REVIEWER") return true;
  if (user.role === "CONTRIBUTOR") {
    return sameDepartment(user.department, block.owner_department);
  }
  return false;
}
