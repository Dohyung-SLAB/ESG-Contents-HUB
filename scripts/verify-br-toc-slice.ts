/**
 * Verify BR Korea TOC slice starts at section body (not a late page).
 * Usage: npx tsx scripts/verify-br-toc-slice.ts "path/to/pdf"
 */
import { readFileSync } from "node:fs";

import {
  extractPdfPages,
  normalizeHeading,
  slicePagesByTocSection,
} from "../lib/services/pdf-extract";

const pdfPath = process.argv[2];
const toc = process.argv[3] ?? "소비자 신뢰 확보";
if (!pdfPath) {
  console.error("Usage: npx tsx scripts/verify-br-toc-slice.ts <pdf> [toc]");
  process.exit(1);
}

async function main() {
  const buf = readFileSync(pdfPath!);
  const pages = await extractPdfPages(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
  console.log("total pages", pages.length);

  const target = normalizeHeading(toc);
  for (const p of pages) {
    const lines = p.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (let li = 0; li < Math.min(40, lines.length); li++) {
      const n = normalizeHeading(lines[li]!);
      if (n.includes(target) || (n.length >= 4 && target.includes(n))) {
        console.log(
          `HIT p.${p.page} li=${li}: ${lines[li]!.slice(0, 80)}`,
        );
      }
    }
  }

  const sliced = slicePagesByTocSection(pages, toc);
  console.log("SLICE", {
    start: sliced.startPage,
    end: sliced.endPage,
    pageCount: sliced.diagnostics.pageCount,
    matched: sliced.matchedHeading,
    hits: sliced.diagnostics.candidateHits,
  });

  if (sliced.startPage == null) {
    console.error("FAIL: no slice");
    process.exit(2);
  }
  // Expected body for 소비자 신뢰 확보 is roughly p.14–19
  if (toc.includes("소비자") && (sliced.startPage < 13 || sliced.startPage > 15)) {
    console.error(
      `FAIL: startPage ${sliced.startPage} unexpected (expected ~14)`,
    );
    process.exit(3);
  }
  if (toc.includes("소비자") && (sliced.endPage ?? 0) < 18) {
    console.error(
      `FAIL: endPage ${sliced.endPage} too early (expected ~19)`,
    );
    process.exit(4);
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
