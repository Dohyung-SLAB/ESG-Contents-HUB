/**
 * Smoke-test TOC slice + outline segmentation against SK Ecoplant PDF.
 * Usage: npx tsx scripts/verify-sk-toc-extract.ts "path/to/SKecoplant_2025_SR_Kor.pdf"
 */
import { readFileSync } from "node:fs";

import {
  extractPdfPages,
  isCaseHeading,
  pagesToPromptText,
  segmentByOutline,
  segmentTocBody,
  slicePagesByTocSection,
  type OutlineItem,
} from "../lib/services/pdf-extract";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: npx tsx scripts/verify-sk-toc-extract.ts <pdf>");
  process.exit(1);
}

async function main() {
  const toc = "지속가능 제품 및 서비스";
  const buf = readFileSync(pdfPath!);
  const pages = await extractPdfPages(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
  const sliced = slicePagesByTocSection(pages, toc);

  console.log("slice:", {
    start: sliced.startPage,
    end: sliced.endPage,
    pageCount: sliced.diagnostics.pageCount,
    hasCase: sliced.diagnostics.hasCasePattern,
    matched: sliced.matchedHeading,
  });

  const caseLines: string[] = [];
  for (const p of sliced.pages) {
    for (const line of p.text.split(/\r?\n/).map((l) => l.trim())) {
      if (isCaseHeading(line)) caseLines.push(`p.${p.page}: ${line}`);
    }
  }
  console.log("case headings in slice:", caseLines.length);
  console.log(caseLines.slice(0, 12));

  const heuristic = segmentTocBody(sliced.pages, toc);
  console.log(
    "heuristic segments:",
    heuristic.length,
    heuristic.map((s) => s.title).slice(0, 20),
  );

  const outline: OutlineItem[] = [
    {
      title: "지속가능 기술 개발",
      level: 1,
      kind: "content",
      startPageHint: sliced.startPage,
    },
    {
      title: "투자 목표 및 계획",
      level: 1,
      kind: "content",
      startPageHint: sliced.startPage,
    },
    {
      title: "지속가능 제품 및 서비스 성과",
      level: 1,
      kind: "category",
      startPageHint: sliced.startPage,
    },
    {
      title: "지속가능한 건축 및 기술 개발",
      level: 2,
      kind: "content",
      startPageHint: sliced.startPage,
    },
    {
      title: "지속가능 제품 및 서비스 추진 방향",
      level: 2,
      kind: "content",
      startPageHint: sliced.startPage,
    },
    ...caseLines.slice(0, 6).map((line) => {
      const m = line.match(/^p\.(\d+):\s*(.+)$/);
      return {
        title: (m?.[2] ?? line).slice(0, 80),
        level: 2 as const,
        kind: "case" as const,
        startPageHint: m ? Number(m[1]) : null,
      };
    }),
  ];

  const byOutline = segmentByOutline(sliced.pages, toc, outline);
  console.log(
    "outline segments:",
    byOutline.length,
    byOutline.map((s) => `${s.title} (p.${s.startPage})`),
  );

  const hasDirection = byOutline.some((s) => s.title.includes("추진"));
  const caseSegs = byOutline.filter(
    (s) => s.kind === "case" || /case/i.test(s.title),
  );
  console.log({
    hasDirection,
    caseSegCount: caseSegs.length,
    hangulInSlice: (
      pagesToPromptText(sliced.pages).match(/[\uac00-\ud7a3]/g) ?? []
    ).length,
  });

  if (!sliced.diagnostics.hasCasePattern && caseLines.length === 0) {
    console.error("FAIL: Case pattern not found in slice window");
    process.exit(2);
  }
  if (caseSegs.length < 6) {
    console.error("FAIL: expected 6 Case segments, got", caseSegs.length);
    process.exit(3);
  }
  if (!hasDirection) {
    console.error("FAIL: 추진 방향 missing");
    process.exit(4);
  }
  console.log("OK verify-sk-toc-extract (slice+segmentation)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
