/**
 * Lightweight regression checks for TOC segmentation helpers.
 * Run: npx tsx scripts/verify-toc-segmentation.ts
 */
import {
  isCaseHeading,
  isTableOrFigureCaption,
  looksLikeStructuralHeading,
  heuristicOutlineKind,
  segmentByOutline,
  type OutlineItem,
  type PdfPage,
} from "../lib/services/pdf-extract";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const pages: PdfPage[] = [
  {
    page: 40,
    text: [
      "지속가능 제품 및 서비스",
      "지속가능 기술 개발",
      "기술 개발 본문입니다. 온실가스 저감 기술을 연구합니다.",
      "투자 목표 및 계획",
      "투자 목표는 2030년까지 확대합니다.",
      "표 4-1 투자 계획",
      "구분 | 2024 | 2025",
    ].join("\n"),
  },
  {
    page: 41,
    text: [
      "지속가능 제품 및 서비스 성과",
      "성과 개요 문단입니다.",
      "지속가능한 건축 및 기술 개발",
      "건축 기술 개발 내용을 서술합니다.",
      "친환경 건축 인증 제도",
      "표 4-2 인증 현황",
      "지속가능 제품 및 서비스 추진 방향",
      "추진 방향 본문입니다.",
    ].join("\n"),
  },
  {
    page: 42,
    text: [
      "Case 1. 친환경 건축 솔루션",
      "케이스 본문 하나.",
      "Case 2. 에너지 효율 서비스",
      "케이스 본문 둘.",
      "Case 3. 스마트 시티",
      "케이스 본문 셋.",
      "Case 4. 수처리",
      "케이스 본문 넷.",
      "Case 5. 재생에너지",
      "케이스 본문 다섯.",
      "Case 6. 순환경제",
      "케이스 본문 여섯.",
    ].join("\n"),
  },
];

assert(isCaseHeading("Case 1. 친환경 건축 솔루션"), "Case 1 should match");
assert(isCaseHeading("사례 2"), "사례 should match");
assert(!isCaseHeading("표 4-1 투자 계획"), "table caption is not case");
assert(isTableOrFigureCaption("표 4-2 인증 현황"), "table caption detect");
assert(
  !looksLikeStructuralHeading("표 4-2 인증 현황", "지속가능 제품 및 서비스"),
  "table caption must not be structural heading",
);

const outline: OutlineItem[] = [
  { title: "지속가능 기술 개발", level: 1, kind: "content", startPageHint: 40 },
  { title: "투자 목표 및 계획", level: 1, kind: "content", startPageHint: 40 },
  {
    title: "지속가능 제품 및 서비스 성과",
    level: 1,
    kind: "category",
    startPageHint: 41,
  },
  {
    title: "지속가능한 건축 및 기술 개발",
    level: 2,
    kind: "content",
    startPageHint: 41,
  },
  {
    title: "지속가능 제품 및 서비스 추진 방향",
    level: 2,
    kind: "content",
    startPageHint: 41,
  },
  {
    title: "Case 1. 친환경 건축 솔루션",
    level: 2,
    kind: "case",
    startPageHint: 42,
  },
  {
    title: "Case 2. 에너지 효율 서비스",
    level: 2,
    kind: "case",
    startPageHint: 42,
  },
  { title: "Case 3. 스마트 시티", level: 2, kind: "case", startPageHint: 42 },
  { title: "Case 4. 수처리", level: 2, kind: "case", startPageHint: 42 },
  { title: "Case 5. 재생에너지", level: 2, kind: "case", startPageHint: 42 },
  { title: "Case 6. 순환경제", level: 2, kind: "case", startPageHint: 42 },
];

const segs = segmentByOutline(pages, "지속가능 제품 및 서비스", outline);
console.log(
  "segments:",
  segs.map((s) => `${s.index}. ${s.title} (p.${s.startPage})`),
);

assert(segs.length >= 10, `expected >=10 segments, got ${segs.length}`);
assert(
  segs.some((s) => s.title.includes("추진 방향")),
  "추진 방향 missing",
);
const cases = segs.filter((s) => /case/i.test(s.title));
assert(cases.length === 6, `expected 6 cases, got ${cases.length}`);
assert(
  !segs.some((s) => s.title.startsWith("표 ")),
  "table caption should not be a segment title",
);
assert(
  segs.some((s) => s.kind === "category" && s.emitCandidate === false),
  "category should not emit candidate",
);
assert(
  heuristicOutlineKind("준법경영 체계") === "category",
  "체계 should be category",
);
assert(
  heuristicOutlineKind("준법경영 추진 방향") === "content",
  "추진 방향 should be content",
);
assert(
  heuristicOutlineKind("컴플라이언스 목표") === "target",
  "목표 should be target",
);

console.log("OK verify-toc-segmentation");
