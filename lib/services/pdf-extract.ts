/**
 * PDF page text extraction, TOC-section slicing, and outline-based segmentation.
 */
import { extractText, getDocumentProxy } from "unpdf";

export type PdfPage = {
  page: number;
  text: string;
};

export type OutlineItem = {
  title: string;
  level: number;
  /**
   * category = report hierarchy label only (not a content block)
   * content = actual writable content block
   * case = case study content
   * target = goal/KPI attached to a parent content
   */
  kind: "category" | "content" | "case" | "target";
  startPageHint: number | null;
  /** Parent category title when kind is content/case/target */
  parentCategory?: string | null;
  /** Parent content title when kind is target */
  parentContent?: string | null;
};

export type TocBodySegment = {
  index: number;
  title: string;
  startPage: number;
  text: string;
  kind?: OutlineItem["kind"];
  level?: number;
  parentCategory?: string | null;
  parentContent?: string | null;
  /** false = hierarchy only; do not create a candidate */
  emitCandidate?: boolean;
};

export type ExtractionSliceDiagnostics = {
  totalPages: number;
  totalChars: number;
  hangulChars: number;
  candidateHits: number;
  usedFallbackWindow: boolean;
  startPage: number | null;
  endPage: number | null;
  pageCount: number;
  hasCasePattern: boolean;
};

export async function extractPdfPages(
  buffer: ArrayBuffer | Uint8Array,
): Promise<PdfPage[]> {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pages: PdfPage[] = [];
  for (let i = 0; i < totalPages; i++) {
    const pageText = Array.isArray(text) ? (text[i] ?? "") : String(text);
    pages.push({ page: i + 1, text: pageText });
  }
  return pages;
}

export function normalizeHeading(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[·•․ㆍ]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip trailing printed page numbers from TOC-style lines ("소비자 신뢰 확보 014"). */
function headingCore(normalized: string) {
  return normalized.replace(/\s+\d{1,3}$/u, "").trim();
}

/** Single TOC listing row (title + page number), not a body chapter title. */
function looksLikeTocEntryLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 80) return false;
  if (/^[↗→➢▶·•]\s*/.test(t) && /\d{1,3}\s*$/.test(t)) return true;
  if (/(\.{2,}|\u2026|\s{2,})\d{1,3}\s*$/.test(t)) return true;
  // "Title 014" / "Title 14" short TOC rows
  const n = normalizeHeading(t);
  const core = headingCore(n);
  if (core && core !== n && /^\d{1,3}$/.test(n.slice(core.length).trim())) {
    return t.length <= 60;
  }
  return false;
}

/** Table-of-contents pages usually have many short lines ending with page numbers. */
function looksLikeTocListingPage(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 5) return false;
  const dottedOrNumbered = lines.filter(
    (l) =>
      looksLikeTocEntryLine(l) ||
      /(\.{2,}|\s{2,})\d{1,3}$/.test(l) ||
      (/\d{1,3}$/.test(l) && l.length < 60),
  ).length;
  return dottedOrNumbered / lines.length >= 0.28;
}

function pageTextQuality(text: string) {
  const compact = text.replace(/\s+/g, "");
  const hangul = (compact.match(/[\uac00-\ud7a3]/g) ?? []).length;
  return { chars: compact.length, hangul };
}

export function isTableOrFigureCaption(line: string): boolean {
  return /^(표|그림|차트|Figure|Table|FIG\.?)\s*[\d.-]*/i.test(line.trim());
}

/** Case / case-study style headings common in Korean SR reports. */
export function isCaseHeading(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 100) return false;
  if (isTableOrFigureCaption(t)) return false;
  // Avoid long prose that merely mentions 사례
  if (t.length > 80 && !/^(case|cases|사례)\b/i.test(t)) return false;
  return (
    /^(case|cases)\b/i.test(t) ||
    /^case\s*(study|studies)?\s*[\d.-]*/i.test(t) ||
    /^사례\s*[\d.-]*/.test(t) ||
    /^\[?\s*case\s*[\divxlc]+/i.test(t) ||
    /^case\s*[①-⑮0-9]/i.test(t)
  );
}

function isStrongChapterHeading(line: string, tocSection: string): boolean {
  const t = line.trim();
  if (!t || t.length > 48 || t.length < 2) return false;
  if (isTableOrFigureCaption(t)) return false;
  if (isCaseHeading(t)) return false;
  if (/^\d{1,3}$/.test(t)) return false;
  if (/[.?!。]$/.test(t)) return false;

  const n = normalizeHeading(t);
  const toc = normalizeHeading(tocSection);
  if (toc && (n === toc || n.includes(toc) || toc.includes(n))) return false;

  // Numbered chapter-ish titles
  if (
    /^(?:\d+(?:\.\d+){0,2}|[①-⑮]|제\d+장|[IVXLC]+\.)\s+\S+/.test(t) &&
    t.length <= 40
  ) {
    return true;
  }
  // Short noun-phrase sibling chapters
  const hangul = (t.match(/[\uac00-\ud7a3]/g) ?? []).length;
  if (hangul >= 4 && hangul <= 24 && t.length <= 36 && !t.includes("|")) {
    if (/(다|요|음|함|임|됨)$/.test(t)) return false;
    return true;
  }
  return false;
}

type HeadingHit = {
  pageIndex: number;
  line: string;
  score: number;
  isListing: boolean;
  lineIndex: number;
};

/**
 * Find pages belonging to a TOC section.
 * Prefers the earliest body chapter start (not late page repeats / TOC listing).
 * Keeps Case blocks inside the window.
 */
export function slicePagesByTocSection(
  pages: PdfPage[],
  tocSection: string,
): {
  pages: PdfPage[];
  startPage: number | null;
  endPage: number | null;
  matchedHeading: string | null;
  diagnostics: ExtractionSliceDiagnostics;
} {
  const target = normalizeHeading(tocSection);
  const totalChars = pages.reduce(
    (s, p) => s + p.text.replace(/\s+/g, "").length,
    0,
  );
  const hangulChars = pages.reduce(
    (s, p) => s + ((p.text.match(/[\uac00-\ud7a3]/g) ?? []).length),
    0,
  );

  const emptyDiagnostics: ExtractionSliceDiagnostics = {
    totalPages: pages.length,
    totalChars,
    hangulChars,
    candidateHits: 0,
    usedFallbackWindow: false,
    startPage: null,
    endPage: null,
    pageCount: 0,
    hasCasePattern: false,
  };

  const empty = {
    pages: [] as PdfPage[],
    startPage: null as number | null,
    endPage: null as number | null,
    matchedHeading: null as string | null,
    diagnostics: emptyDiagnostics,
  };

  if (!target) return empty;

  const hits: HeadingHit[] = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const isListing = looksLikeTocListingPage(page.text);
    const lines = page.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    for (let li = 0; li < Math.min(60, lines.length); li++) {
      const line = lines[li]!;
      const n = normalizeHeading(line);
      if (!n) continue;
      const core = headingCore(n);
      const tocEntry = looksLikeTocEntryLine(line);
      const exact = core === target || n === target;
      const contains =
        core.includes(target) ||
        n.includes(target) ||
        (target.length >= 4 && target.includes(core));
      if (!exact && !contains) continue;
      if (line.length > 100) continue;

      let score = exact ? 120 : 50;
      score += Math.max(0, 35 - Math.min(line.length, 35));
      // Materiality / compound lines that merely mention the TOC title are weak
      if (!exact && core.length > target.length + 4) score -= 45;
      if (!exact && !core.startsWith(target)) score -= 20;
      if (isListing || tocEntry) score -= 90;
      // Chapter openings / running section titles are near the top of a page
      if (li < 3) score += 30;
      else if (li < 8) score += 10;
      // Prefer earlier body pages — late repeats must not steal the start
      // (e.g. p.19 over p.14). Keep the penalty mild so exact titles still win.
      score -= Math.min(20, Math.floor(i / 4));
      hits.push({
        pageIndex: i,
        line,
        score,
        isListing: isListing || tocEntry,
        lineIndex: li,
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);

  let startIdx = -1;
  let matchedHeading: string | null = null;
  let usedFallbackWindow = false;

  const bodyHits = hits.filter((h) => !h.isListing);
  const ranked = bodyHits.length > 0 ? bodyHits : hits;

  // Prefer earliest exact (or near-exact) title near the top of a body page.
  // This is the real chapter start; compound mentions and late repeats lose.
  const exactTop = bodyHits.filter((h) => {
    const core = headingCore(normalizeHeading(h.line));
    return (
      h.lineIndex < 5 &&
      !looksLikeTocEntryLine(h.line) &&
      (core === target ||
        (core.startsWith(target) && core.length <= target.length + 6))
    );
  });
  let lockedExactStart = false;
  if (exactTop.length > 0) {
    startIdx = Math.min(...exactTop.map((h) => h.pageIndex));
    matchedHeading =
      exactTop.find((h) => h.pageIndex === startIdx)?.line ?? null;
    lockedExactStart = true;
  } else if (ranked.length > 0) {
    const best = ranked[0]!;
    // Among near-best body hits, take the earliest page (true section start)
    const cohort = ranked.filter((h) => h.score >= best.score - 35);
    startIdx = Math.min(...cohort.map((h) => h.pageIndex));
    matchedHeading =
      cohort.find((h) => h.pageIndex === startIdx)?.line ?? best.line;
  }

  if (startIdx < 0) {
    const hitPages = pages
      .map((p, idx) => ({ p, idx, q: pageTextQuality(p.text) }))
      .filter(
        ({ p, q }) =>
          normalizeHeading(p.text).includes(target) &&
          q.chars > 40 &&
          !looksLikeTocListingPage(p.text),
      );
    if (hitPages.length === 0) {
      return {
        ...empty,
        diagnostics: { ...emptyDiagnostics, candidateHits: hits.length },
      };
    }
    startIdx = hitPages[0]!.idx;
    matchedHeading = tocSection;
  }

  // Safety net only when we did not lock an exact chapter title: if a slightly
  // lower-scoring *exact* body hit appears earlier, prefer that page.
  if (!lockedExactStart && bodyHits.length > 0 && startIdx >= 0) {
    const bestScore = ranked[0]?.score ?? 0;
    const earlier = bodyHits.filter((h) => {
      if (h.pageIndex >= startIdx || startIdx - h.pageIndex > 12) return false;
      if (looksLikeTocEntryLine(h.line)) return false;
      const core = headingCore(normalizeHeading(h.line));
      const exactish =
        core === target ||
        (core.startsWith(target) && core.length <= target.length + 6);
      return exactish && (h.lineIndex < 8 || h.score >= bestScore - 50);
    });
    if (earlier.length > 0) {
      startIdx = Math.min(...earlier.map((h) => h.pageIndex));
      matchedHeading =
        earlier.find((h) => h.pageIndex === startIdx)?.line ?? matchedHeading;
    }
  }

  const MAX_PAGES = 40;
  const sliced: PdfPage[] = [];
  let collectedHangul = 0;
  let sawCase = false;

  for (let i = startIdx; i < pages.length; i++) {
    const page = pages[i]!;
    const pageHasCase = page.text
      .split(/\r?\n/)
      .some((l) => isCaseHeading(l.trim()));
    if (pageHasCase) sawCase = true;

    if (i > startIdx) {
      const lines = page.text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      const first = lines[0] ?? "";
      // Stop only on a true sibling chapter — never on Case / table captions.
      const sibling =
        collectedHangul > 400 &&
        isStrongChapterHeading(first, tocSection) &&
        !isCaseHeading(first) &&
        !normalizeHeading(first).includes(target);

      if (sibling) {
        // Keep extending while Case blocks still appear ahead (same TOC section).
        const lookahead = pages.slice(i, Math.min(pages.length, i + 8));
        const caseAhead = lookahead.some((p) =>
          p.text.split(/\r?\n/).some((l) => isCaseHeading(l.trim())),
        );
        if (!caseAhead) break;
      }
    }

    sliced.push(page);
    collectedHangul += pageTextQuality(page.text).hangul;
    if (sliced.length >= MAX_PAGES) break;
    if (collectedHangul > 16000 && sawCase) break;
    if (collectedHangul > 22000) break;
  }

  const sliceHangul = sliced.reduce(
    (s, p) => s + pageTextQuality(p.text).hangul,
    0,
  );
  if (sliceHangul < 80) {
    usedFallbackWindow = true;
    const from = Math.max(0, startIdx - 1);
    const to = Math.min(pages.length, startIdx + 20);
    const windowPages = pages.slice(from, to);
    const hasCasePattern = windowPages.some((p) =>
      p.text.split(/\r?\n/).some((l) => isCaseHeading(l.trim())),
    );
    return {
      pages: windowPages,
      startPage: pages[startIdx]!.page,
      endPage: windowPages[windowPages.length - 1]?.page ?? null,
      matchedHeading,
      diagnostics: {
        ...emptyDiagnostics,
        candidateHits: hits.length,
        usedFallbackWindow,
        startPage: pages[startIdx]!.page,
        endPage: windowPages[windowPages.length - 1]?.page ?? null,
        pageCount: windowPages.length,
        hasCasePattern,
      },
    };
  }

  const hasCasePattern =
    sawCase ||
    sliced.some((p) =>
      p.text.split(/\r?\n/).some((l) => isCaseHeading(l.trim())),
    );

  return {
    pages: sliced,
    startPage: pages[startIdx]!.page,
    endPage: sliced[sliced.length - 1]?.page ?? null,
    matchedHeading,
    diagnostics: {
      ...emptyDiagnostics,
      candidateHits: hits.length,
      usedFallbackWindow,
      startPage: pages[startIdx]!.page,
      endPage: sliced[sliced.length - 1]?.page ?? null,
      pageCount: sliced.length,
      hasCasePattern,
    },
  };
}

export function pagesToPromptText(pages: PdfPage[], maxChars = 80000): string {
  let out = "";
  for (const p of pages) {
    const chunk = `\n\n--- PAGE ${p.page} ---\n${p.text}`;
    if (out.length + chunk.length > maxChars) break;
    out += chunk;
  }
  return out.trim();
}

export function summarizeExtractedText(pages: PdfPage[]) {
  const chars = pages.reduce((s, p) => s + p.text.replace(/\s+/g, "").length, 0);
  const hangul = pages.reduce(
    (s, p) => s + ((p.text.match(/[\uac00-\ud7a3]/g) ?? []).length),
    0,
  );
  return { pageCount: pages.length, chars, hangul };
}

export function heuristicOutlineKind(title: string): OutlineItem["kind"] {
  const t = title.trim();
  if (isCaseHeading(t)) return "case";
  // Common Korean SR container headings (not standalone content blocks)
  if (
    /(체계|개요|추진\s*활동|추진체계|관리\s*체계|운영\s*체계)$/.test(t) ||
    /^(체계|개요)$/.test(t)
  ) {
    return "category";
  }
  if (/(목표|타깃|KPI|중장기\s*목표)$/i.test(t) || /^목표/.test(t)) {
    return "target";
  }
  return "content";
}

/**
 * Structural heading used for heuristic fallback (NOT table captions).
 */
export function looksLikeStructuralHeading(
  line: string,
  tocSection: string,
): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t.length > 60) return false;
  if (t.length < 2) return false;
  if (/^---\s*PAGE\s+\d+/i.test(t)) return false;
  if (/^페이지\s*\d+/i.test(t)) return false;
  if (/^\d{1,3}$/.test(t)) return false;
  if (/^[\d.,%\s]+$/.test(t)) return false;
  if (isTableOrFigureCaption(t)) return false; // demoted — stay in body
  if (isCaseHeading(t)) return true;

  if (
    /^(?:\d+(?:\.\d+){0,3}|[①-⑮]|[가-하]\)|[A-Z]\)|제\d+장|[IVXLC]+\.)\s+\S+/.test(
      t,
    )
  ) {
    return true;
  }
  if (/^[■▶●◆▪◦•·․ㆍ]\s*\S+/.test(t)) return true;

  const hangul = (t.match(/[\uac00-\ud7a3]/g) ?? []).length;
  // Allow English-heavy Case-like titles already handled; other English short titles
  if (hangul < 2) {
    return /^[A-Z][A-Za-z0-9 \-/&]{2,40}$/.test(t) && t.length <= 48;
  }
  if (/[.?!。]$/.test(t)) return false;
  if (t.includes("|")) return false;
  if (t.split(/\s+/).length > 12) return false;

  const n = normalizeHeading(t);
  const toc = normalizeHeading(tocSection);
  if (toc && n === toc) return true;
  if (/(다|요|음|함|임|됨)$/.test(t) && hangul > 8) return false;
  return hangul >= 2 && t.length <= 40;
}

/**
 * Heuristic fallback segmentation (no AI outline).
 * Table/figure captions do NOT start new segments.
 */
export function segmentTocBody(
  pages: PdfPage[],
  tocSection: string,
): TocBodySegment[] {
  type LineRef = { page: number; text: string; isHeading: boolean; kind: OutlineItem["kind"] };
  const lines: LineRef[] = [];

  for (const p of pages) {
    const pageLines = p.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    for (const text of pageLines) {
      const isHeading = looksLikeStructuralHeading(text, tocSection);
      const kind: OutlineItem["kind"] = isCaseHeading(text)
        ? "case"
        : isHeading
          ? heuristicOutlineKind(text)
          : "content";
      lines.push({ page: p.page, text, isHeading, kind });
    }
  }

  if (lines.length === 0) return [];

  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]!.isHeading) continue;
    if (starts.length === 0) {
      starts.push(i);
      continue;
    }
    const prev = starts[starts.length - 1]!;
    // Case headings always split even with short gaps
    if (lines[i]!.kind === "case" || i - prev >= 2) starts.push(i);
  }
  if (starts.length === 0) starts.push(0);

  const raw: TocBodySegment[] = [];
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s]!;
    const to = s + 1 < starts.length ? starts[s + 1]! : lines.length;
    const chunk = lines.slice(from, to);
    if (chunk.length === 0) continue;
    const titleLine = chunk[0]!;
    const title = titleLine.isHeading
      ? titleLine.text
      : tocSection || `구간 ${s + 1}`;
    const body = chunk
      .map((l) => l.text)
      .join("\n")
      .trim();
    const hangul = (body.match(/[\uac00-\ud7a3]/g) ?? []).length;
    if (hangul < 15 && chunk.length < 3 && titleLine.kind !== "case") continue;
    raw.push({
      index: raw.length + 1,
      title: title.slice(0, 80),
      startPage: titleLine.page,
      text: body,
      kind: titleLine.kind,
      emitCandidate: titleLine.kind !== "category",
    });
  }

  // Attach parent category / content for hierarchy metadata
  let currentCategory: string | null = null;
  let currentContent: string | null = null;
  for (const seg of raw) {
    if (seg.kind === "category") {
      currentCategory = seg.title;
      seg.parentCategory = null;
      seg.emitCandidate = false;
      continue;
    }
    seg.parentCategory = currentCategory;
    if (seg.kind === "target") {
      seg.parentContent = currentContent;
    } else {
      currentContent = seg.title;
      seg.parentContent = null;
    }
  }

  const merged: TocBodySegment[] = [];
  for (const seg of raw) {
    const hangul = (seg.text.match(/[\uac00-\ud7a3]/g) ?? []).length;
    // Never merge Case segments away; never merge category markers into previous content incorrectly
    if (
      merged.length > 0 &&
      hangul < 25 &&
      seg.kind !== "case" &&
      seg.kind !== "category" &&
      seg.kind !== "target"
    ) {
      const prev = merged[merged.length - 1]!;
      if (prev.kind !== "case" && prev.kind !== "category") {
        prev.text = `${prev.text}\n${seg.text}`.trim();
        continue;
      }
    }
    // Merge target text into parent content when extremely thin? keep separate for now
    merged.push({ ...seg, index: merged.length + 1 });
  }

  return merged.length > 0
    ? merged
    : [
        {
          index: 1,
          title: tocSection,
          startPage: pages[0]?.page ?? 1,
          text: pagesToPromptText(pages),
          kind: "content",
          emitCandidate: true,
        },
      ];
}

/**
 * Split page window by outline titles (from AI or heuristics).
 * Each outline item (section / subsection / case) becomes one segment.
 */
export function segmentByOutline(
  pages: PdfPage[],
  tocSection: string,
  outline: OutlineItem[],
): TocBodySegment[] {
  if (!outline.length) return segmentTocBody(pages, tocSection);

  type LineRef = { page: number; text: string };
  const lines: LineRef[] = [];
  for (const p of pages) {
    for (const text of p.text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)) {
      lines.push({ page: p.page, text });
    }
  }
  if (lines.length === 0) return segmentTocBody(pages, tocSection);

  const findLineIndex = (item: OutlineItem, from: number): number => {
    const target = normalizeHeading(item.title);
    if (!target) return -1;
    let best = -1;
    let bestScore = -1;
    const end = lines.length;
    for (let i = from; i < end; i++) {
      const n = normalizeHeading(lines[i]!.text);
      if (!n) continue;
      if (lines[i]!.text.length > 120) continue;
      if (isTableOrFigureCaption(lines[i]!.text)) continue;
      let score = 0;
      if (n === target) score = 100;
      else if (n.includes(target) || target.includes(n)) score = 70;
      else continue;
      if (item.startPageHint != null) {
        const dist = Math.abs(lines[i]!.page - item.startPageHint);
        score -= Math.min(20, dist * 2);
      }
      // Prefer earlier occurrence after previous match
      score -= Math.min(15, Math.floor((i - from) / 80));
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
      if (score >= 95) break;
    }
    return best;
  };

  const starts: Array<{ lineIndex: number; item: OutlineItem }> = [];
  let cursor = 0;
  for (const item of outline) {
    let idx = findLineIndex(item, cursor);
    if (idx < 0) idx = findLineIndex(item, 0);
    if (idx < 0) continue;
    // Keep outline order: skip if before previous start
    if (starts.length > 0 && idx <= starts[starts.length - 1]!.lineIndex) {
      const retry = findLineIndex(item, starts[starts.length - 1]!.lineIndex + 1);
      if (retry < 0) continue;
      idx = retry;
    }
    starts.push({ lineIndex: idx, item });
    cursor = idx + 1;
  }

  if (starts.length === 0) return segmentTocBody(pages, tocSection);

  let currentCategory: string | null = null;
  let currentContent: string | null = null;
  const segments: TocBodySegment[] = [];
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s]!.lineIndex;
    const to =
      s + 1 < starts.length ? starts[s + 1]!.lineIndex : lines.length;
    const chunk = lines.slice(from, to);
    const item = starts[s]!.item;
    const body = chunk.map((l) => l.text).join("\n").trim();
    if (!body) continue;

    const kind = item.kind;
    if (kind === "category") {
      currentCategory = item.title;
    }

    const parentCategory =
      item.parentCategory ?? (kind === "category" ? null : currentCategory);
    const parentContent =
      item.parentContent ??
      (kind === "target" ? currentContent : null);

    if (kind === "content" || kind === "case") {
      currentContent = item.title;
    }

    segments.push({
      index: segments.length + 1,
      title: item.title.slice(0, 80),
      startPage: chunk[0]?.page ?? pages[0]?.page ?? 1,
      text: body,
      kind,
      level: item.level,
      parentCategory,
      parentContent,
      emitCandidate: kind !== "category",
    });
  }

  return segments.length > 0 ? segments : segmentTocBody(pages, tocSection);
}
