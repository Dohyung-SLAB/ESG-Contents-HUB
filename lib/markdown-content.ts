/**
 * Lightweight Markdown helpers for extraction narratives:
 * paragraphs + GFM-style pipe tables. Images are intentionally ignored.
 */

export type NarrativeBlock =
  | { type: "paragraph"; text: string }
  | { type: "table"; headers: string[]; rows: string[][] };

function splitCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function isSeparatorRow(line: string): boolean {
  const cells = splitCells(line);
  return (
    cells.length > 0 &&
    cells.every((c) => /^:?-{3,}:?$/.test(c.replace(/\s+/g, "")))
  );
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.includes("|") && !/^[-*+]\s/.test(t);
}

/** Parse narrative into paragraphs and markdown tables. */
export function parseNarrativeBlocks(narrative: string): NarrativeBlock[] {
  const lines = (narrative ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: NarrativeBlock[] = [];
  let para: string[] = [];

  const flushPara = () => {
    const text = para.join("\n").trim();
    if (text) blocks.push({ type: "paragraph", text });
    para = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const next = lines[i + 1] ?? "";

    if (
      isTableRow(line) &&
      isSeparatorRow(next) &&
      splitCells(line).length === splitCells(next).length
    ) {
      flushPara();
      const headers = splitCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i] ?? "")) {
        const row = splitCells(lines[i]!);
        if (row.every((c) => c === "")) break;
        rows.push(row);
        i += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (line.trim() === "") {
      flushPara();
    } else {
      para.push(line);
    }
    i += 1;
  }
  flushPara();
  return blocks;
}
