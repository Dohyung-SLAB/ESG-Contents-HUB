/**
 * Samlip pilot seed constants (UI/Workflow test data only).
 * Do not treat values as verified facts from the actual sustainability report.
 */

import type {
  ContentType,
  KeyFactValueType,
  UpdateType,
} from "@/types/enums";

export const SAMLIP_IDS = {
  company: "11111111-1111-4111-8111-111111111101",
  project2026: "22222222-2222-4222-8222-222222222201",
  project2027: "22222222-2222-4222-8222-222222222202",
  issue: "33333333-3333-4333-8333-333333333301",
} as const;

/** Deterministic UUID helpers for CT-001..CT-018 (n = 1..18). */
export function blockId(n: number): string {
  const seq = String(n).padStart(2, "0");
  return `44444444-4444-4444-8444-4444444444${seq}`;
}

export function versionId(n: number, year: 2026 | 2027): string {
  const seq = String(n).padStart(2, "0");
  const yearCode = year === 2026 ? "26" : "27";
  return `55555555-5555-4555-8555-55555555${yearCode}${seq}`;
}

export function keyFactId(code: string, index: number): string {
  const map: Record<string, string> = {
    "CT-006": "66",
    "CT-018": "18",
  };
  const prefix = map[code] ?? "00";
  const seq = String(index).padStart(2, "0");
  return `66666666-6666-4666-8666-66666666${prefix}${seq}`;
}

export type SeedBlockDef = {
  n: number;
  code: string;
  title: string;
  content_type: ContentType;
  update_type: UpdateType;
  section: string;
  sub_topic: string | null;
};

export const SAMLIP_BLOCKS: SeedBlockDef[] = [
  {
    n: 1,
    code: "CT-001",
    title: "소비자중심경영 체계",
    content_type: "GOVERNANCE",
    update_type: "NARRATIVE",
    section: "소비자 신뢰 확보",
    sub_topic: "거버넌스",
  },
  {
    n: 2,
    code: "CT-002",
    title: "소비자 신뢰 확보 추진 조직",
    content_type: "GOVERNANCE",
    update_type: "STRUCTURE",
    section: "소비자 신뢰 확보",
    sub_topic: "조직",
  },
  {
    n: 3,
    code: "CT-003",
    title: "VOC·CCM 운영 회의체",
    content_type: "GOVERNANCE",
    update_type: "STRUCTURE",
    section: "소비자 신뢰 확보",
    sub_topic: "회의체",
  },
  {
    n: 4,
    code: "CT-004",
    title: "소비자 신뢰 관련 위험 및 기회",
    content_type: "RISK_OPPORTUNITY",
    update_type: "NARRATIVE",
    section: "소비자 신뢰 확보",
    sub_topic: "위험 및 기회",
  },
  {
    n: 5,
    code: "CT-005",
    title: "소비자 신뢰 확보 중장기 로드맵",
    content_type: "STRATEGY",
    update_type: "TARGET",
    section: "소비자 신뢰 확보",
    sub_topic: "로드맵",
  },
  {
    n: 6,
    code: "CT-006",
    title: "위해상품 판매차단 시스템",
    content_type: "ACTIVITY",
    update_type: "ACTIVITY",
    section: "소비자 신뢰 확보",
    sub_topic: "식품안전",
  },
  {
    n: 7,
    code: "CT-007",
    title: "사업장 식품안전 점검",
    content_type: "PERFORMANCE",
    update_type: "NUMERIC",
    section: "소비자 신뢰 확보",
    sub_topic: "식품안전",
  },
  {
    n: 8,
    code: "CT-008",
    title: "식품안전 교육",
    content_type: "ACTIVITY",
    update_type: "ACTIVITY",
    section: "소비자 신뢰 확보",
    sub_topic: "식품안전",
  },
  {
    n: 9,
    code: "CT-009",
    title: "식품안전 인증",
    content_type: "CERTIFICATION",
    update_type: "CERTIFICATION",
    section: "소비자 신뢰 확보",
    sub_topic: "인증",
  },
  {
    n: 10,
    code: "CT-010",
    title: "식품안전·품질경영 내재화",
    content_type: "ACTIVITY",
    update_type: "NARRATIVE",
    section: "소비자 신뢰 확보",
    sub_topic: "품질경영",
  },
  {
    n: 11,
    code: "CT-011",
    title: "VOC 운영",
    content_type: "PROCESS",
    update_type: "ACTIVITY",
    section: "소비자 신뢰 확보",
    sub_topic: "VOC",
  },
  {
    n: 12,
    code: "CT-012",
    title: "소비자분쟁 대응",
    content_type: "PROCESS",
    update_type: "NARRATIVE",
    section: "소비자 신뢰 확보",
    sub_topic: "VOC",
  },
  {
    n: 13,
    code: "CT-013",
    title: "통합 VOC 시스템 고도화",
    content_type: "ACTIVITY",
    update_type: "ACTIVITY",
    section: "소비자 신뢰 확보",
    sub_topic: "VOC",
  },
  {
    n: 14,
    code: "CT-014",
    title: "고객 중심 혁신제품",
    content_type: "ACTIVITY",
    update_type: "ACTIVITY",
    section: "소비자 신뢰 확보",
    sub_topic: "제품",
  },
  {
    n: 15,
    code: "CT-015",
    title: "고객 브랜드 경험",
    content_type: "ACTIVITY",
    update_type: "ACTIVITY",
    section: "소비자 신뢰 확보",
    sub_topic: "브랜드",
  },
  {
    n: 16,
    code: "CT-016",
    title: "식품안전 이슈 모니터링",
    content_type: "RISK_OPPORTUNITY",
    update_type: "NARRATIVE",
    section: "소비자 신뢰 확보",
    sub_topic: "모니터링",
  },
  {
    n: 17,
    code: "CT-017",
    title: "클레임 관리 목표 및 실적",
    content_type: "TARGET",
    update_type: "NUMERIC",
    section: "소비자 신뢰 확보",
    sub_topic: "목표·실적",
  },
  {
    n: 18,
    code: "CT-018",
    title: "VOC 운영 실적",
    content_type: "PERFORMANCE",
    update_type: "NUMERIC",
    section: "소비자 신뢰 확보",
    sub_topic: "VOC 실적",
  },
];

export type SeedFormField = {
  key: string;
  label: string;
  value_type: KeyFactValueType;
  unit: string;
};

export const CT018_FORM_FIELDS: SeedFormField[] = [
  { key: "문의 건수", label: "문의 건수", value_type: "NUMBER", unit: "건" },
  { key: "불만 건수", label: "불만 건수", value_type: "NUMBER", unit: "건" },
  { key: "칭찬·제안", label: "칭찬·제안", value_type: "NUMBER", unit: "건" },
  { key: "처리비율", label: "처리비율", value_type: "PERCENT", unit: "%" },
  {
    key: "상담 만족도",
    label: "상담 만족도",
    value_type: "SCORE",
    unit: "점",
  },
];

export const CT018_FORM_SCHEMA = {
  fields: CT018_FORM_FIELDS,
};

export type SeedKeyFactDef = {
  id: string;
  key: string;
  value_text: string | null;
  value_number: number | null;
  unit: string | null;
  value_type: KeyFactValueType;
  display_order: number;
};

export const CT006_KEY_FACTS_2026: SeedKeyFactDef[] = [
  {
    id: keyFactId("CT-006", 1),
    key: "적용 매장",
    value_text: null,
    value_number: 188,
    unit: "개",
    value_type: "NUMBER",
    display_order: 1,
  },
  {
    id: keyFactId("CT-006", 2),
    key: "모의훈련 주기",
    value_text: "반기 1회",
    value_number: null,
    unit: null,
    value_type: "FREQUENCY",
    display_order: 2,
  },
];

export const CT018_KEY_FACTS_2026: SeedKeyFactDef[] = [
  {
    id: keyFactId("CT-018", 1),
    key: "문의 건수",
    value_text: null,
    value_number: 11607,
    unit: "건",
    value_type: "NUMBER",
    display_order: 1,
  },
  {
    id: keyFactId("CT-018", 2),
    key: "불만 건수",
    value_text: null,
    value_number: 2185,
    unit: "건",
    value_type: "NUMBER",
    display_order: 2,
  },
  {
    id: keyFactId("CT-018", 3),
    key: "칭찬·제안",
    value_text: null,
    value_number: 445,
    unit: "건",
    value_type: "NUMBER",
    display_order: 3,
  },
  {
    id: keyFactId("CT-018", 4),
    key: "처리비율",
    value_text: "99%",
    value_number: 99,
    unit: "%",
    value_type: "PERCENT",
    display_order: 4,
  },
  {
    id: keyFactId("CT-018", 5),
    key: "상담 만족도",
    value_text: "93점",
    value_number: 93,
    unit: "점",
    value_type: "SCORE",
    display_order: 5,
  },
];

export const SAMLIP_COMPANY = {
  id: SAMLIP_IDS.company,
  name: "삼립",
  brand_primary: "#1e3a5f",
} as const;

export const SAMLIP_PROJECTS = [
  {
    id: SAMLIP_IDS.project2026,
    company_id: SAMLIP_IDS.company,
    name: "2026 Sustainability Report",
    reporting_year: 2026,
    base_year: null as number | null,
    status: "COMPLETED" as const,
  },
  {
    id: SAMLIP_IDS.project2027,
    company_id: SAMLIP_IDS.company,
    name: "2027 Sustainability Report",
    reporting_year: 2027,
    base_year: 2026,
    status: "ACTIVE" as const,
  },
] as const;

export const SAMLIP_ISSUE = {
  id: SAMLIP_IDS.issue,
  project_id: SAMLIP_IDS.project2027,
  name: "소비자 신뢰 확보",
  category: "SOCIAL" as const,
  display_order: 1,
} as const;
