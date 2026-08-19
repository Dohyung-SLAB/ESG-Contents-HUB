/**
 * Lightweight Markdown helpers for extraction narratives:
 * paragraphs + GFM-style pipe tables + figure/table captions.
 * Keep this module free of server-only PDF deps (used by client components).
 */

export type NarrativeBlock =
  | { type: "paragraph"; text: string }
  | { type: "table"; headers: string[]; rows: string[][]; caption?: string }
  | { type: "figure"; caption: string };

function isTableOrFigureCaption(line: string): boolean {
  return /^(표|그림|차트|Figure|Table|FIG\.?)\s*[\d.-]*/i.test(line.trim());
}

export type TableChartSeries = {
  label: string;
  values: Array<{ series: string; value: number }>;
};

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

/** Parse a cell into a number when possible (%, commas, units stripped lightly). */
export function parseNumericCell(raw: string): number | null {
  const t = raw.replace(/,/g, "").trim();
  if (!t || /^[-–—]$/.test(t)) return null;
  const m = t.match(/^-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * When a markdown table has a label column + numeric columns,
 * return series suitable for a simple bar chart.
 */
export function tableToChartSeries(
  headers: string[],
  rows: string[][],
): TableChartSeries[] | null {
  if (headers.length < 2 || rows.length === 0 || rows.length > 16) return null;

  const numericCols: number[] = [];
  for (let c = 1; c < headers.length; c++) {
    const nums = rows
      .map((r) => parseNumericCell(r[c] ?? ""))
      .filter((n): n is number => n != null);
    if (nums.length >= Math.ceil(rows.length * 0.6)) numericCols.push(c);
  }
  if (numericCols.length === 0) return null;

  return numericCols.map((c) => {
    const values: Array<{ series: string; value: number }> = [];
    for (const r of rows) {
      const value = parseNumericCell(r[c] ?? "");
      if (value == null) continue;
      values.push({ series: (r[0] ?? "").trim() || "—", value });
    }
    return {
      label: headers[c] || `열 ${c + 1}`,
      values,
    };
  });
}

/** Parse narrative into paragraphs, markdown tables, and figure captions. */
export function parseNarrativeBlocks(narrative: string): NarrativeBlock[] {
  const lines = (narrative ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: NarrativeBlock[] = [];
  let para: string[] = [];
  let pendingCaption: string | null = null;

  const flushPara = () => {
    const text = para.join("\n").trim();
    if (text) blocks.push({ type: "paragraph", text });
    para = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const next = lines[i + 1] ?? "";
    const trimmed = line.trim();

    if (trimmed && isTableOrFigureCaption(trimmed)) {
      flushPara();
      if (/^(표|Table)\b/i.test(trimmed)) {
        pendingCaption = trimmed;
      } else {
        blocks.push({ type: "figure", caption: trimmed });
        pendingCaption = null;
      }
      i += 1;
      continue;
    }

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
      blocks.push({
        type: "table",
        headers,
        rows,
        caption: pendingCaption ?? undefined,
      });
      pendingCaption = null;
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
