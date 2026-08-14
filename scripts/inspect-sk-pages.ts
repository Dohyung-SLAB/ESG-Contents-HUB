import { readFileSync } from "node:fs";
import {
  extractPdfPages,
  isCaseHeading,
  normalizeHeading,
} from "../lib/services/pdf-extract";

async function main() {
  const pdfPath = process.argv[2]!;
  const buf = readFileSync(pdfPath);
  const pages = await extractPdfPages(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  );
  for (let i = 88; i < Math.min(pages.length, 115); i++) {
    const p = pages[i]!;
    const lines = p.text
      .split(/\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const cases = lines.filter(isCaseHeading);
    const first = lines[0] ?? "";
    const caseLike = lines.filter((l) => /case|사례|CASE/i.test(l)).slice(0, 5);
    console.log(
      `p.${p.page} first=${JSON.stringify(first.slice(0, 70))} cases=${cases.length}`,
    );
    if (caseLike.length) console.log("  hints:", caseLike);
  }
  // Find all CASE across doc near section
  const all: string[] = [];
  for (const p of pages) {
    if (p.page < 85 || p.page > 120) continue;
    for (const line of p.text.split(/\n/).map((l) => l.trim())) {
      if (/case|사례/i.test(line) && line.length < 100) {
        all.push(`p.${p.page}: ${line}`);
      }
    }
  }
  console.log("\nALL case-like lines 85-120:");
  console.log(all.join("\n"));
}

main();
