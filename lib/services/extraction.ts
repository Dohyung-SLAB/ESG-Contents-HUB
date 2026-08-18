import { newId, touch } from "@/lib/data/ids";
import {
  getCurrentUser as getPilotCurrentUser,
  getPilotStore,
} from "@/lib/data/pilot-store";
import { getSessionUser } from "@/lib/data/session";
import { writeAuditLog } from "@/lib/services/audit";
import { canManageExtraction } from "@/lib/services/permissions";
import {
  extractPdfPages,
  heuristicOutlineKind,
  pagesToPromptText,
  segmentByOutline,
  segmentTocBody,
  slicePagesByTocSection,
  type OutlineItem,
  type TocBodySegment,
} from "@/lib/services/pdf-extract";
import { getActiveWorkspace } from "@/lib/services/projects";
import { toStorageObjectName } from "@/lib/storage-key";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  ExtractionCandidate,
  ExtractionJob,
  ExtractionKeyFact,
} from "@/types/database";
import {
  CONTENT_TYPES,
  UPDATE_TYPES,
  type ContentType,
  type UpdateType,
} from "@/types/enums";

export type ExtractionDiagnostics = {
  startPage: number | null;
  endPage: number | null;
  pageCount: number;
  hangulChars: number;
  hasCasePattern: boolean;
  usedFallbackWindow: boolean;
  matchedHeading: string | null;
  outline: OutlineItem[];
  segmentCount: number;
  segmentTitles: string[];
  outlineSource: "ai" | "heuristic";
};

type AiCandidate = {
  title: string;
  section: string;
  subTopic?: string | null;
  contentType: string;
  updateType: string;
  narrative: string;
  keyFacts?: ExtractionKeyFact[];
  sourcePage: number;
  sourceText: string;
  confidence: number;
};

function mapContentType(raw: string): ContentType {
  const upper = raw.toUpperCase().replace(/\s+/g, "_");
  if ((CONTENT_TYPES as readonly string[]).includes(upper)) {
    return upper as ContentType;
  }
  const aliases: Record<string, ContentType> = {
    RISK: "RISK_OPPORTUNITY",
    METRIC: "PERFORMANCE",
    OTHER: "PROCESS",
    MIXED: "ACTIVITY",
  };
  return aliases[upper] ?? "ACTIVITY";
}

function mapUpdateType(raw: string): UpdateType {
  const upper = raw.toUpperCase();
  if ((UPDATE_TYPES as readonly string[]).includes(upper)) {
    return upper as UpdateType;
  }
  if (upper === "MIXED") return "NARRATIVE";
  return "NARRATIVE";
}

async function runOutlineExtraction(input: {
  tocSection: string;
  pageText: string;
}): Promise<OutlineItem[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("your-openai")) {
    throw new Error(
      "OPENAI_API_KEY가 필요합니다. .env.local에 키를 설정한 뒤 다시 시도하세요.",
    );
  }

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content: `You extract the hierarchical outline of TOC section "${input.tocSection}" from a sustainability report.
Return JSON: {"outline":[{"title":string,"level":1|2|3,"kind":"category"|"content"|"case"|"target","startPageHint":number|null,"parentCategory":string|null,"parentContent":string|null}]}

Kind definitions (critical):
- category: Report hierarchy / section labels that GROUP content but are NOT standalone writing blocks.
  Examples: "준법경영 체계", "준법경영 추진 활동", "… 체계", "… 개요".
- content: Actual content blocks that can be owned, updated, and approved.
  Examples: "준법경영 추진 방향", "공정거래 자율준수 의지 표명", "컴플라이언스 교육", activities, policies in substance.
- case: Case / CASE / Case Study / 사례 items (always separate).
- target: Goals/KPIs that belong UNDER a content item (e.g. "컴플라이언스 목표" under "준법경영 추진 방향").
  Set parentContent to that content title.

Rules:
- Prefer marking container headings as category; mark leaf narrative/activity blocks as content.
- ALWAYS list each Case/CASE/사례 as kind=case.
- Do NOT invent headings. Do NOT list table/figure captions (표/그림/Table/Figure).
- Do NOT list the main TOC title alone if children exist.
- startPageHint from --- PAGE N --- when possible.
- parentCategory = nearest enclosing category title (or null).`,
      },
      { role: "user", content: input.pageText.slice(0, 100000) },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim() ?? "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return [];
  }
  const list = Array.isArray(parsed.outline) ? parsed.outline : [];
  const out: OutlineItem[] = [];
  let currentCategory: string | null = null;
  let currentContent: string | null = null;

  for (const item of list) {
    const row = item as Record<string, unknown>;
    const title = String(row.title ?? "").trim();
    if (!title || title.length > 120) continue;
    if (/^(표|그림|차트|Figure|Table)\b/i.test(title)) continue;

    const kindRaw = String(row.kind ?? "").toLowerCase();
    let kind: OutlineItem["kind"];
    if (kindRaw === "case") kind = "case";
    else if (kindRaw === "target") kind = "target";
    else if (kindRaw === "category" || kindRaw === "section") kind = "category";
    else if (kindRaw === "content" || kindRaw === "subsection") kind = "content";
    else kind = heuristicOutlineKind(title);

    if (kind === "category") currentCategory = title;

    const parentCategory =
      (row.parentCategory as string | null | undefined) ??
      (row.parent_category as string | null | undefined) ??
      (kind === "category" ? null : currentCategory);
    const parentContent =
      (row.parentContent as string | null | undefined) ??
      (row.parent_content as string | null | undefined) ??
      (kind === "target" ? currentContent : null);

    if (kind === "content" || kind === "case") currentContent = title;

    const level = Math.min(
      3,
      Math.max(
        1,
        Number(row.level) ||
          (kind === "category" ? 1 : kind === "case" || kind === "target" ? 3 : 2),
      ),
    );
    const hint = row.startPageHint ?? row.start_page_hint;
    out.push({
      title: title.slice(0, 80),
      level,
      kind,
      startPageHint: hint == null || hint === "" ? null : Number(hint) || null,
      parentCategory: parentCategory ?? null,
      parentContent: parentContent ?? null,
    });
  }
  return out;
}

async function runSegmentedTocAiExtraction(input: {
  tocSection: string;
  segments: TocBodySegment[];
}): Promise<AiCandidate[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("your-openai")) {
    throw new Error(
      "OPENAI_API_KEY가 필요합니다. .env.local에 키를 설정한 뒤 다시 시도하세요.",
    );
  }

  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey });

  const eligible = input.segments.filter((s) => s.emitCandidate !== false);
  if (eligible.length === 0) return [];

  const BATCH = 4;
  const all: AiCandidate[] = [];

  for (let offset = 0; offset < eligible.length; offset += BATCH) {
    const batch = eligible.slice(offset, offset + BATCH);
    const userPayload = batch
      .map(
        (s) =>
          `===== SEGMENT ${s.index} =====\nTITLE_HINT: ${s.title}\nKIND: ${s.kind ?? "content"}\nPARENT_CATEGORY: ${s.parentCategory ?? ""}\nPARENT_CONTENT: ${s.parentContent ?? ""}\nSTART_PAGE: ${s.startPage}\nSOURCE:\n${s.text.slice(0, 14000)}`,
      )
      .join("\n\n");

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      max_tokens: 16000,
      messages: [
        {
          role: "system",
          content: `You convert pre-split sustainability-report segments into Content Block candidates.
TOC section: "${input.tocSection}".

HARD RULES:
1) Produce EXACTLY one candidate per SEGMENT. Never merge/drop.
2) Do NOT invent facts/numbers. Do NOT summarize or shorten prose.
3) narrative = FULL SOURCE text of that segment (nearly verbatim), tables as Markdown.
4) Images/charts: omit visuals; keep captions only.
5) title MUST equal TITLE_HINT exactly.
6) section = "${input.tocSection}" and append " > PARENT_CATEGORY" when PARENT_CATEGORY is set.
7) subTopic = PARENT_CONTENT when KIND=target, else TITLE_HINT.
8) contentType is chosen from THIS segment's narrative character (not fixed in advance):
   POLICY | GOVERNANCE | STRATEGY | RISK_OPPORTUNITY | TARGET | ACTIVITY | PERFORMANCE | PROCESS | CERTIFICATION
   e.g. goals→TARGET; education/procedures→PROCESS/ACTIVITY; commitment/principles→POLICY/GOVERNANCE; results→PERFORMANCE.
9) updateType ∈ NARRATIVE,STRUCTURE,ACTIVITY,NUMERIC,TARGET,CERTIFICATION based on the text.
10) If KIND=target, prefer contentType=TARGET and updateType=TARGET.
11) Return JSON {"candidates":[...]} with segmentIndex.`,
        },
        { role: "user", content: userPayload },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "{}";
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error("AI 응답 JSON 파싱에 실패했습니다.");
    }
    const list = Array.isArray(parsed.candidates)
      ? (parsed.candidates as unknown[])
      : [];

    const byIndex = new Map<number, AiCandidate>();
    list.forEach((item, pos) => {
      const c = item as Record<string, unknown>;
      const idx =
        Number(c.segmentIndex ?? c.segment_index ?? 0) ||
        batch[pos]?.index ||
        0;
      const cand: AiCandidate = {
        title: String(c.title ?? c.Title ?? "Untitled"),
        section: String(c.section ?? c.Section ?? input.tocSection),
        subTopic: (c.subTopic ?? c.sub_topic ?? null) as string | null,
        contentType: String(c.contentType ?? c.content_type ?? ""),
        updateType: String(c.updateType ?? c.update_type ?? ""),
        narrative: String(c.narrative ?? c.Narrative ?? ""),
        keyFacts: (c.keyFacts ?? c.key_facts ?? []) as ExtractionKeyFact[],
        sourcePage: Number(c.sourcePage ?? c.source_page ?? 0) || 0,
        sourceText: String(c.sourceText ?? c.source_text ?? ""),
        confidence: Number(c.confidence ?? 0.75),
      };
      if (idx > 0 && !byIndex.has(idx)) byIndex.set(idx, cand);
    });

    for (const seg of batch) {
      const ai = byIndex.get(seg.index);
      const rawHangul = (seg.text.match(/[\uac00-\ud7a3]/g) ?? []).length;
      const aiHangul = (ai?.narrative.match(/[\uac00-\ud7a3]/g) ?? []).length;

      const tooShort =
        !ai || aiHangul < Math.min(80, Math.floor(rawHangul * 0.55));

      const lockedTitle = seg.title;
      const parent = seg.parentCategory?.trim() ?? "";
      const toc = input.tocSection.trim();
      const sectionPath =
        parent && parent !== toc ? `${toc} > ${parent}` : toc;
      const subTopic =
        seg.kind === "target" && seg.parentContent
          ? seg.parentContent
          : lockedTitle;

      const suggestedType =
        seg.kind === "target"
          ? "TARGET"
          : ai?.contentType?.trim() ||
            suggestContentTypeFromText(seg.title, seg.text);
      const suggestedUpdate =
        seg.kind === "target"
          ? "TARGET"
          : ai?.updateType?.trim() || "NARRATIVE";

      if (tooShort) {
        all.push({
          title: lockedTitle,
          section: sectionPath,
          subTopic,
          contentType: suggestedType,
          updateType: suggestedUpdate,
          narrative: seg.text,
          keyFacts: ai?.keyFacts ?? [],
          sourcePage: seg.startPage,
          sourceText: seg.text.slice(0, 4000),
          confidence: ai ? Math.min(ai.confidence, 0.7) : 0.65,
        });
      } else {
        all.push({
          ...ai,
          title: lockedTitle,
          section: sectionPath,
          subTopic,
          contentType: suggestedType,
          updateType: suggestedUpdate,
          sourcePage: ai.sourcePage || seg.startPage,
          narrative: aiHangul >= rawHangul * 0.85 ? ai.narrative : seg.text,
          sourceText: ai.sourceText || seg.text.slice(0, 4000),
        });
      }
    }
  }

  return all;
}

function suggestContentTypeFromText(title: string, text: string): string {
  const t = `${title}\n${text.slice(0, 800)}`;
  if (/목표|타깃|KPI|중장기\s*목표/i.test(t)) return "TARGET";
  if (/인증|ISO|등급/i.test(t)) return "CERTIFICATION";
  if (/성과|실적|배출량|매출|비율|%|증가|감소/.test(t)) return "PERFORMANCE";
  if (/위험|리스크|기회/.test(t)) return "RISK_OPPORTUNITY";
  if (/전략|로드맵|방향/.test(t)) return "STRATEGY";
  if (/정책|원칙|헌장|방침/.test(t)) return "POLICY";
  if (/지배구조|위원회|이사회|거버넌스|준법|컴플라이언스|공정거래/.test(t)) {
    return "GOVERNANCE";
  }
  if (/교육|운영|프로세스|절차|제도|협의|편람|진단/.test(t)) return "PROCESS";
  if (/활동|추진|이행|실시/.test(t)) return "ACTIVITY";
  return "PROCESS";
}

function encodeDiagnostics(d: ExtractionDiagnostics): string {
  return `__ESG_DIAG__${JSON.stringify(d)}`;
}

export function parseJobDiagnostics(
  job: Pick<ExtractionJob, "error_message" | "status">,
): ExtractionDiagnostics | null {
  const raw = job.error_message;
  if (!raw || !raw.startsWith("__ESG_DIAG__")) return null;
  try {
    return JSON.parse(raw.slice("__ESG_DIAG__".length)) as ExtractionDiagnostics;
  } catch {
    return null;
  }
}

function toDbCandidates(
  jobId: string,
  tocSection: string,
  ai: AiCandidate[],
): ExtractionCandidate[] {
  const ts = touch();
  return ai.map((c, i) => ({
    id: newId(),
    job_id: jobId,
    title: c.title,
    section: c.section || tocSection,
    sub_topic: c.subTopic ?? null,
    content_type: mapContentType(c.contentType),
    update_type: mapUpdateType(c.updateType),
    narrative: c.narrative,
    key_facts: c.keyFacts ?? [],
    source_page: c.sourcePage,
    source_text: c.sourceText,
    confidence: Math.min(1, Math.max(0, c.confidence ?? 0.7)),
    display_order: i + 1,
    esg_frameworks: [],
    disclosure_frameworks: [],
    created_at: ts,
    updated_at: ts,
  }));
}

/**
 * Create a short-lived signed upload URL so the browser can PUT the PDF
 * straight to Supabase Storage (bypasses Vercel's 4.5MB function body limit).
 */
export async function prepareReportUpload(input: {
  filename: string;
  byteLength: number;
}) {
  const user = await getSessionUser();
  if (!canManageExtraction(user.role)) {
    throw new Error("컨설턴트(ADMIN)만 Extraction Job을 생성할 수 있습니다.");
  }
  if (!input.filename.toLowerCase().endsWith(".pdf")) {
    throw new Error("PDF 파일만 업로드할 수 있습니다.");
  }
  if (input.byteLength <= 0) throw new Error("빈 파일입니다.");
  if (input.byteLength > 50 * 1024 * 1024) {
    throw new Error("PDF는 50MB 이하여야 합니다.");
  }
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase Storage가 필요합니다. NEXT_PUBLIC_SUPABASE_URL / keys를 확인하세요.",
    );
  }

  const workspace = await getActiveWorkspace();
  const uploadId = newId();
  // Supabase Storage rejects keys with spaces/non-ASCII ("Invalid key: …").
  // Keep the real name in original_filename / DB only.
  const safeName = toStorageObjectName(input.filename);
  const storagePath = `${workspace.company.id}/${workspace.project.id}/${uploadId}/${safeName}`;

  const admin = createSupabaseAdminClient();
  const { error: bucketErr } = await admin.storage.createBucket("reports", {
    public: false,
    fileSizeLimit: 52428800,
    allowedMimeTypes: ["application/pdf"],
  });
  if (bucketErr && !/already exists|duplicate/i.test(bucketErr.message)) {
    // Bucket may already exist — ignore; other errors still surface on signed URL.
  }

  const { data, error } = await admin.storage
    .from("reports")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    throw new Error(
      error?.message ??
        "업로드 URL을 만들지 못했습니다. reports 버킷을 확인하세요.",
    );
  }

  return {
    storagePath: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  };
}

export async function createExtractionJobFromUpload(input: {
  filename: string;
  toc_section: string;
  /** PDF already uploaded to Storage (required on Vercel). */
  storage_path: string;
}) {
  const user = await getSessionUser();
  if (!canManageExtraction(user.role)) {
    throw new Error("컨설턴트(ADMIN)만 Extraction Job을 생성할 수 있습니다.");
  }

  const tocSection = input.toc_section.trim();
  if (!tocSection) throw new Error("목차명(TOC section)을 입력하세요.");
  if (!input.filename.toLowerCase().endsWith(".pdf")) {
    throw new Error("PDF 파일만 업로드할 수 있습니다.");
  }

  const storagePath = input.storage_path.trim();
  if (!storagePath) {
    throw new Error(
      "storage_path가 필요합니다. 브라우저에서 Supabase Storage로 PDF를 먼저 업로드하세요.",
    );
  }

  const workspace = await getActiveWorkspace();
  const ts = touch();
  const jobId = newId();

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase가 설정되지 않아 Storage PDF를 읽을 수 없습니다. 환경 변수를 확인하세요.",
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from("reports")
    .download(storagePath);

  if (error || !data) {
    throw new Error(
      error?.message ??
        "Storage에서 PDF를 받지 못했습니다. 업로드 후 다시 시도하세요.",
    );
  }
  const buffer = Buffer.from(await data.arrayBuffer());

  if (buffer.byteLength > 50 * 1024 * 1024) {
    throw new Error("PDF는 50MB 이하여야 합니다.");
  }

  // Copy into a real ArrayBuffer (Node Buffer.buffer may be SharedArrayBuffer-typed).
  const arrayBuffer = Uint8Array.from(buffer).buffer;

  const job = {
    id: jobId,
    project_id: workspace.project.id,
    storage_path: storagePath,
    original_filename: input.filename,
    toc_section: tocSection,
    status: "PROCESSING" as const,
    error_message: null as string | null,
    created_by: user.id,
    created_at: ts,
    updated_at: ts,
  };

  {
    const { error: jErr } = await admin.from("extraction_jobs").insert(job);
    if (jErr) {
      // toc_section column may be missing before migration
      const { error: jErr2 } = await admin.from("extraction_jobs").insert({
        id: job.id,
        project_id: job.project_id,
        storage_path: job.storage_path,
        original_filename: job.original_filename,
        status: job.status,
        error_message: job.error_message,
        created_by: job.created_by,
        created_at: job.created_at,
        updated_at: job.updated_at,
      });
      if (jErr2) throw new Error(jErr2.message);
    }
  }

  try {
    const pages = await extractPdfPages(arrayBuffer);
    const whole = pagesToPromptText(pages).replace(/\s+/g, "");
    const wholeHangul = (whole.match(/[\uac00-\ud7a3]/g) ?? []).length;
    if (wholeHangul < 50) {
      throw new Error(
        "PDF에서 한글 본문을 거의 읽지 못했습니다. (이미지 PDF이거나 폰트 임베딩 문제일 수 있습니다.) 텍스트 선택 가능한 PDF로 다시 시도하세요.",
      );
    }

    const sliced = slicePagesByTocSection(pages, tocSection);
    if (sliced.pages.length === 0) {
      throw new Error(
        `목차 "${tocSection}"에 해당하는 페이지를 PDF 텍스트에서 찾지 못했습니다. 보고서 본문에 쓰인 목차명과 동일하게 입력해 보세요.`,
      );
    }

    const promptText = pagesToPromptText(sliced.pages);
    const sliceHangul = (promptText.match(/[\uac00-\ud7a3]/g) ?? []).length;
    if (sliceHangul < 40) {
      throw new Error(
        `목차 "${tocSection}" 구간 텍스트가 너무 적습니다 (한글 ${sliceHangul}자, 시작 p.${sliced.startPage ?? "?"}). 목차 표 페이지가 잡혔거나 해당 챕터 텍스트 추출에 실패했을 수 있습니다.`,
      );
    }

    let outline = await runOutlineExtraction({
      tocSection,
      pageText: promptText,
    });
    let outlineSource: ExtractionDiagnostics["outlineSource"] = "ai";
    if (outline.length < 2) {
      outlineSource = "heuristic";
      // Build a minimal outline from heuristic structural headings
      const heuristicSegs = segmentTocBody(sliced.pages, tocSection);
      outline = heuristicSegs.map((s) => ({
        title: s.title,
        level: s.kind === "case" || s.kind === "target" ? 3 : s.kind === "category" ? 1 : 2,
        kind: (s.kind ?? heuristicOutlineKind(s.title)) as OutlineItem["kind"],
        startPageHint: s.startPage,
        parentCategory: s.parentCategory ?? null,
        parentContent: s.parentContent ?? null,
      }));
    }

    const segments =
      outline.length > 0
        ? segmentByOutline(sliced.pages, tocSection, outline)
        : segmentTocBody(sliced.pages, tocSection);

    const candidateSegments = segments.filter((s) => s.emitCandidate !== false);

    if (candidateSegments.length === 0) {
      throw new Error(
        `목차 "${tocSection}"에서 Content Block으로 만들 본문 구간을 찾지 못했습니다. (카테고리 제목만 감지되었을 수 있습니다)`,
      );
    }

    const diagnostics: ExtractionDiagnostics = {
      startPage: sliced.diagnostics.startPage,
      endPage: sliced.diagnostics.endPage,
      pageCount: sliced.diagnostics.pageCount,
      hangulChars: sliceHangul,
      hasCasePattern: sliced.diagnostics.hasCasePattern,
      usedFallbackWindow: sliced.diagnostics.usedFallbackWindow,
      matchedHeading: sliced.matchedHeading,
      outline,
      segmentCount: candidateSegments.length,
      segmentTitles: candidateSegments.map((s) => s.title),
      outlineSource,
    };

    const ai = await runSegmentedTocAiExtraction({
      tocSection,
      segments,
    });
    if (ai.length === 0) {
      throw new Error(
        `AI가 목차 "${tocSection}"에서 Content Block 후보를 만들지 못했습니다. 목차명을 본문 제목과 더 가깝게 바꿔 보거나, 다른 세부 목차로 시도해 보세요. (매칭 p.${sliced.startPage ?? "?"}, 구간 ${segments.length}개, 한글 ${sliceHangul}자)`,
      );
    }
    const candidates = toDbCandidates(jobId, tocSection, ai);
    const diagPayload = encodeDiagnostics(diagnostics);

    if (isSupabaseConfigured()) {
      const admin = createSupabaseAdminClient();
      const { error: cErr } = await admin
        .from("extraction_candidates")
        .insert(candidates);
      if (cErr) throw new Error(cErr.message);
      await admin
        .from("extraction_jobs")
        .update({
          status: "REVIEW_REQUIRED",
          // Store diagnostics without a schema migration (parsed by parseJobDiagnostics)
          error_message: diagPayload,
          updated_at: touch(),
        })
        .eq("id", jobId);
    } else {
      const store = getPilotStore();
      store.extraction_candidates.push(...candidates);
      const j = store.extraction_jobs.find((x) => x.id === jobId);
      if (j) {
        j.status = "REVIEW_REQUIRED";
        j.error_message = diagPayload;
        j.updated_at = touch();
      }
    }

    await writeAuditLog({
      action: "CREATE",
      entity_type: "extraction_jobs",
      entity_id: jobId,
      before_data: null,
      after_data: {
        jobId,
        toc_section: tocSection,
        candidate_count: candidates.length,
        diagnostics,
      },
    });

    return {
      job: {
        ...job,
        status: "REVIEW_REQUIRED" as const,
        error_message: diagPayload,
      },
      candidates,
      diagnostics,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed";
    if (isSupabaseConfigured()) {
      const admin = createSupabaseAdminClient();
      await admin
        .from("extraction_jobs")
        .update({
          status: "FAILED",
          error_message: message,
          updated_at: touch(),
        })
        .eq("id", jobId);
    } else {
      const j = getPilotStore().extraction_jobs.find((x) => x.id === jobId);
      if (j) {
        j.status = "FAILED";
        j.error_message = message;
        j.updated_at = touch();
      }
    }
    throw new Error(message);
  }
}

/** @deprecated Use createExtractionJobFromUpload */
export async function createExtractionJob(input: {
  original_filename: string;
  storage_path?: string;
}) {
  throw new Error(
    `파일 업로드와 목차명이 필요합니다. "${input.original_filename}" 단독 생성은 더 이상 지원하지 않습니다.`,
  );
}

export async function getExtractionJob(jobId: string) {
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const job = store.extraction_jobs.find((j) => j.id === jobId);
    if (!job) return null;
    const candidates = store.extraction_candidates
      .filter((c) => c.job_id === jobId)
      .sort((a, b) => a.display_order - b.display_order);
    return withSummary(job, candidates, parseJobDiagnostics(job));
  }

  const admin = createSupabaseAdminClient();
  const { data: job } = await admin
    .from("extraction_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return null;
  const { data: candidates } = await admin
    .from("extraction_candidates")
    .select("*")
    .eq("job_id", jobId)
    .order("display_order");
  return withSummary(
    job as ExtractionJob,
    candidates ?? [],
    parseJobDiagnostics(job as ExtractionJob),
  );
}

function withSummary<
  TJob extends { id: string; original_filename: string },
  TCandidate extends { confidence: number | null },
>(
  job: TJob,
  candidates: TCandidate[],
  diagnostics: ExtractionDiagnostics | null = null,
) {
  const high = candidates.filter((c) => (c.confidence ?? 0) >= 0.9).length;
  const review = candidates.filter((c) => {
    const conf = c.confidence ?? 0;
    return conf >= 0.75 && conf < 0.9;
  }).length;
  const attention = candidates.filter((c) => (c.confidence ?? 0) < 0.75).length;
  return {
    job,
    candidates,
    summary: { total: candidates.length, high, review, attention },
    diagnostics,
  };
}

export async function listExtractionJobs() {
  const workspace = await getActiveWorkspace();
  if (!isSupabaseConfigured()) {
    return getPilotStore()
      .extraction_jobs.filter((j) => j.project_id === workspace.project.id)
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("extraction_jobs")
    .select("*")
    .eq("project_id", workspace.project.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateCandidate(
  candidateId: string,
  patch: Partial<{
    title: string;
    content_type: ContentType;
    update_type: UpdateType;
    narrative: string;
    esg_frameworks: string[];
    disclosure_frameworks: string[];
  }>,
) {
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const candidate = store.extraction_candidates.find(
      (c) => c.id === candidateId,
    );
    if (!candidate) throw new Error("Candidate를 찾을 수 없습니다.");
    Object.assign(candidate, patch, { updated_at: touch() });
    return candidate;
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("extraction_candidates")
    .update({ ...patch, updated_at: touch() })
    .eq("id", candidateId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Approve many candidates sequentially (bulk / select-all). */
export async function approveCandidates(candidateIds: string[]) {
  if (candidateIds.length === 0) {
    throw new Error("승인할 후보를 선택하세요.");
  }
  const results: Array<{ id: string; ok: true } | { id: string; ok: false; error: string }> =
    [];
  for (const id of candidateIds) {
    try {
      await approveCandidate(id);
      results.push({ id, ok: true });
    } catch (e) {
      results.push({
        id,
        ok: false,
        error: e instanceof Error ? e.message : "승인 실패",
      });
    }
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length === candidateIds.length) {
    throw new Error(
      failed[0] && "error" in failed[0]
        ? failed[0].error
        : "전체 승인에 실패했습니다.",
    );
  }
  return {
    approved: results.filter((r) => r.ok).length,
    failed: failed.length,
    results,
  };
}

export async function deleteCandidate(candidateId: string) {
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    store.extraction_candidates = store.extraction_candidates.filter(
      (c) => c.id !== candidateId,
    );
    return;
  }
  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("extraction_candidates")
    .delete()
    .eq("id", candidateId);
  if (error) throw new Error(error.message);
}

export async function mergeCandidates(candidateIds: string[]) {
  if (candidateIds.length < 2) throw new Error("병합에는 2개 이상 필요합니다.");

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const items = store.extraction_candidates.filter((c) =>
      candidateIds.includes(c.id),
    );
    if (items.length < 2) throw new Error("Candidate를 찾을 수 없습니다.");
    const primary = items[0];
    primary.title = items.map((i) => i.title).join(" / ");
    primary.narrative = items
      .map((i) => i.narrative)
      .filter(Boolean)
      .join("\n\n");
    primary.key_facts = items.flatMap((i) => i.key_facts);
    primary.confidence = Math.min(...items.map((i) => i.confidence ?? 0));
    primary.updated_at = touch();
    const drop = new Set(candidateIds.slice(1));
    store.extraction_candidates = store.extraction_candidates.filter(
      (c) => !drop.has(c.id),
    );
    return primary;
  }

  const admin = createSupabaseAdminClient();
  const { data: items, error } = await admin
    .from("extraction_candidates")
    .select("*")
    .in("id", candidateIds);
  if (error) throw new Error(error.message);
  if (!items || items.length < 2) {
    throw new Error("Candidate를 찾을 수 없습니다.");
  }
  const primary = items[0];
  const { data: updated, error: uErr } = await admin
    .from("extraction_candidates")
    .update({
      title: items.map((i) => i.title).join(" / "),
      narrative: items
        .map((i) => i.narrative)
        .filter(Boolean)
        .join("\n\n"),
      key_facts: items.flatMap((i) => i.key_facts ?? []),
      confidence: Math.min(...items.map((i) => i.confidence ?? 0)),
      updated_at: touch(),
    })
    .eq("id", primary.id)
    .select()
    .single();
  if (uErr) throw new Error(uErr.message);

  await admin
    .from("extraction_candidates")
    .delete()
    .in("id", candidateIds.slice(1));
  return updated;
}

export async function splitCandidate(candidateId: string, titles: string[]) {
  if (titles.length < 2) throw new Error("분할에는 제목 2개 이상이 필요합니다.");

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const candidate = store.extraction_candidates.find(
      (c) => c.id === candidateId,
    );
    if (!candidate) throw new Error("Candidate를 찾을 수 없습니다.");
    const ts = touch();
    candidate.title = titles[0];
    candidate.updated_at = ts;
    const created = titles.slice(1).map((title, i) => ({
      ...candidate,
      id: newId(),
      title,
      display_order: candidate.display_order + i + 1,
      confidence: Math.max(0.5, (candidate.confidence ?? 0.7) - 0.05),
      created_at: ts,
      updated_at: ts,
    }));
    store.extraction_candidates.push(...created);
    return { candidate, created };
  }

  const admin = createSupabaseAdminClient();
  const { data: candidate, error } = await admin
    .from("extraction_candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!candidate) throw new Error("Candidate를 찾을 수 없습니다.");

  const ts = touch();
  await admin
    .from("extraction_candidates")
    .update({ title: titles[0], updated_at: ts })
    .eq("id", candidateId);

  const created = titles.slice(1).map((title, i) => ({
    ...candidate,
    id: newId(),
    title,
    display_order: candidate.display_order + i + 1,
    confidence: Math.max(0.5, (candidate.confidence ?? 0.7) - 0.05),
    created_at: ts,
    updated_at: ts,
  }));
  const { error: iErr } = await admin
    .from("extraction_candidates")
    .insert(created);
  if (iErr) throw new Error(iErr.message);

  return { candidate: { ...candidate, title: titles[0] }, created };
}

export async function approveCandidate(candidateId: string, issueId?: string) {
  const workspace = await getActiveWorkspace();
  const resolvedIssueId =
    issueId ?? workspace.defaultIssue?.id ?? null;
  if (!resolvedIssueId) {
    throw new Error("프로젝트에 Issue가 없습니다. Settings에서 생성하세요.");
  }
  const baseYear =
    workspace.project.base_year ?? workspace.project.reporting_year - 1;
  const reportingYear = workspace.project.reporting_year;

  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const user = getPilotCurrentUser();
    const candidate = store.extraction_candidates.find(
      (c) => c.id === candidateId,
    );
    if (!candidate) throw new Error("Candidate를 찾을 수 없습니다.");
    if (!candidate.content_type || !candidate.update_type) {
      throw new Error("Content Type / Update Type이 필요합니다.");
    }
    const ts = touch();
    const code = `CT-X${String(store.content_blocks.length + 1).padStart(2, "0")}`;
    const blockId = newId();
    const previousVersionId = newId();
    const currentVersionId = newId();
    store.content_blocks.push({
      id: blockId,
      issue_id: resolvedIssueId,
      parent_block_id: null,
      code,
      section: candidate.section,
      sub_topic: candidate.sub_topic,
      title: candidate.title,
      content_type: candidate.content_type,
      update_type: candidate.update_type,
      owner_department: user.department,
      owner_user_id: null,
      reviewer_user_id: null,
      form_schema: {},
      display_order: store.content_blocks.length + 1,
      is_active: true,
      esg_frameworks: candidate.esg_frameworks ?? [],
      disclosure_frameworks: candidate.disclosure_frameworks ?? [],
      created_at: ts,
      updated_at: ts,
    });
    // Baseline (previous year) from PDF
    store.content_versions.push({
      id: previousVersionId,
      content_block_id: blockId,
      reporting_year: baseYear,
      previous_version_id: null,
      narrative: candidate.narrative,
      change_type: "NEW",
      change_summary: "PDF extraction import",
      status: "APPROVED",
      source_document:
        store.extraction_jobs.find((j) => j.id === candidate.job_id)
          ?.original_filename ?? null,
      source_page: candidate.source_page,
      created_by: user.id,
      updated_by: user.id,
      approved_by: user.id,
      created_at: ts,
      updated_at: ts,
      approved_at: ts,
    });
    // Current reporting year row for Annual Update
    store.content_versions.push({
      id: currentVersionId,
      content_block_id: blockId,
      reporting_year: reportingYear,
      previous_version_id: previousVersionId,
      narrative: null,
      change_type: "PENDING",
      change_summary: null,
      status: "NOT_STARTED",
      source_document: null,
      source_page: null,
      created_by: user.id,
      updated_by: user.id,
      approved_by: null,
      created_at: ts,
      updated_at: ts,
      approved_at: null,
    });
    candidate.key_facts.forEach((kf, idx) => {
      store.key_facts.push({
        id: newId(),
        content_version_id: previousVersionId,
        key: kf.key,
        value_text: kf.value_text ?? null,
        value_number: kf.value_number ?? null,
        unit: kf.unit ?? null,
        value_type: kf.value_type ?? "TEXT",
        display_order: idx + 1,
        created_at: ts,
        updated_at: ts,
      });
    });
    void writeAuditLog({
      action: "CREATE",
      entity_type: "content_blocks",
      entity_id: blockId,
      before_data: null,
      after_data: {
        blockId,
        previousVersionId,
        currentVersionId,
        from_candidate: candidateId,
      },
    });
    store.extraction_candidates = store.extraction_candidates.filter(
      (c) => c.id !== candidateId,
    );
    return { blockId, versionId: currentVersionId, code };
  }

  const user = await getSessionUser();
  const admin = createSupabaseAdminClient();
  const { data: candidate, error } = await admin
    .from("extraction_candidates")
    .select("*")
    .eq("id", candidateId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!candidate) throw new Error("Candidate를 찾을 수 없습니다.");
  if (!candidate.content_type || !candidate.update_type) {
    throw new Error("Content Type / Update Type이 필요합니다.");
  }

  const { count } = await admin
    .from("content_blocks")
    .select("*", { count: "exact", head: true });
  const ts = touch();
  const code = `CT-X${String((count ?? 0) + 1).padStart(2, "0")}`;
  const blockId = newId();
  const previousVersionId = newId();
  const currentVersionId = newId();

  const { data: job } = await admin
    .from("extraction_jobs")
    .select("original_filename")
    .eq("id", candidate.job_id)
    .maybeSingle();

  const { error: bErr } = await admin.from("content_blocks").insert({
    id: blockId,
    issue_id: resolvedIssueId,
    parent_block_id: null,
    code,
    section: candidate.section,
    sub_topic: candidate.sub_topic,
    title: candidate.title,
    content_type: candidate.content_type,
    update_type: candidate.update_type,
    owner_department: user.department,
    owner_user_id: null,
    reviewer_user_id: null,
    form_schema: {},
    display_order: (count ?? 0) + 1,
    is_active: true,
    esg_frameworks: candidate.esg_frameworks ?? [],
    disclosure_frameworks: candidate.disclosure_frameworks ?? [],
    created_at: ts,
    updated_at: ts,
  });
  if (bErr) throw new Error(bErr.message);

  const { error: prevErr } = await admin.from("content_versions").insert({
    id: previousVersionId,
    content_block_id: blockId,
    reporting_year: baseYear,
    previous_version_id: null,
    narrative: candidate.narrative,
    change_type: "NEW",
    change_summary: "PDF extraction import",
    status: "APPROVED",
    source_document: job?.original_filename ?? null,
    source_page: candidate.source_page,
    created_by: user.id,
    updated_by: user.id,
    approved_by: user.id,
    created_at: ts,
    updated_at: ts,
    approved_at: ts,
  });
  if (prevErr) throw new Error(prevErr.message);

  const { error: currErr } = await admin.from("content_versions").insert({
    id: currentVersionId,
    content_block_id: blockId,
    reporting_year: reportingYear,
    previous_version_id: previousVersionId,
    narrative: null,
    change_type: "PENDING",
    change_summary: null,
    status: "NOT_STARTED",
    source_document: null,
    source_page: null,
    created_by: user.id,
    updated_by: user.id,
    approved_by: null,
    created_at: ts,
    updated_at: ts,
    approved_at: null,
  });
  if (currErr) throw new Error(currErr.message);

  const facts = (candidate.key_facts ?? []) as ExtractionKeyFact[];
  if (facts.length) {
    await admin.from("key_facts").insert(
      facts.map((kf, idx) => ({
        id: newId(),
        content_version_id: previousVersionId,
        key: kf.key,
        value_text: kf.value_text ?? null,
        value_number: kf.value_number ?? null,
        unit: kf.unit ?? null,
        value_type: kf.value_type ?? "TEXT",
        display_order: idx + 1,
        created_at: ts,
        updated_at: ts,
      })),
    );
  }

  await admin.from("extraction_candidates").delete().eq("id", candidateId);

  await writeAuditLog({
    action: "CREATE",
    entity_type: "content_blocks",
    entity_id: blockId,
    before_data: null,
    after_data: {
      blockId,
      previousVersionId,
      currentVersionId,
      from_candidate: candidateId,
    },
  });

  return { blockId, versionId: currentVersionId, code };
}
