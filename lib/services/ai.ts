import { newId, touch } from "@/lib/data/ids";
import {
  getCurrentUser as getPilotCurrentUser,
  getPilotStore,
} from "@/lib/data/pilot-store";
import { getSessionUser } from "@/lib/data/session";
import { writeAuditLog } from "@/lib/services/audit";
import { getBlockDetail, getKeyFacts } from "@/lib/services/library";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { KeyFact } from "@/types/database";
import type { AiSuggestionType } from "@/types/enums";

export type ChangeSummaryPayload = {
  changedFacts: Array<{ key: string; from: string; to: string }>;
  unchangedFacts: Array<{ key: string; value: string }>;
  newFacts: Array<{ key: string; value: string }>;
  removedFacts: Array<{ key: string; value: string }>;
  warnings: string[];
  summary: string;
};

function factLabel(f: KeyFact): string {
  if (f.value_number != null && f.unit) return `${f.value_number}${f.unit}`;
  if (f.value_number != null) return String(f.value_number);
  return f.value_text ?? "";
}

/** Rule-based numeric/text fact diff — no LLM. */
export function buildRuleChangeSummary(
  previous: KeyFact[],
  current: KeyFact[],
): ChangeSummaryPayload {
  const prevMap = new Map(previous.map((f) => [f.key, f]));
  const currMap = new Map(current.map((f) => [f.key, f]));
  const changedFacts: ChangeSummaryPayload["changedFacts"] = [];
  const unchangedFacts: ChangeSummaryPayload["unchangedFacts"] = [];
  const newFacts: ChangeSummaryPayload["newFacts"] = [];
  const removedFacts: ChangeSummaryPayload["removedFacts"] = [];

  for (const [key, curr] of currMap) {
    const prev = prevMap.get(key);
    if (!prev) {
      newFacts.push({ key, value: factLabel(curr) });
      continue;
    }
    const from = factLabel(prev);
    const to = factLabel(curr);
    if (from === to) unchangedFacts.push({ key, value: to });
    else changedFacts.push({ key, from, to });
  }
  for (const [key, prev] of prevMap) {
    if (!currMap.has(key)) {
      removedFacts.push({ key, value: factLabel(prev) });
    }
  }

  const parts: string[] = [];
  for (const c of changedFacts) {
    parts.push(`${c.key}이(가) ${c.from}에서 ${c.to}(으)로 변경되었습니다`);
  }
  for (const u of unchangedFacts) {
    parts.push(`${u.key}는 ${u.value}(으)로 유지되었습니다`);
  }
  for (const n of newFacts) {
    parts.push(`${n.key} ${n.value}이(가) 신규로 추가되었습니다`);
  }

  const summary =
    parts.length > 0
      ? `${parts.join(", ")}.`
      : "전년 대비 주요 Key Fact 변경이 없습니다.";

  return {
    changedFacts,
    unchangedFacts,
    newFacts,
    removedFacts,
    warnings: [],
    summary,
  };
}

async function maybeOpenAISummary(
  payload: ChangeSummaryPayload,
  previousNarrative: string | null,
): Promise<ChangeSummaryPayload> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("your-openai")) {
    if (payload.changedFacts.some((c) => c.key === "적용 매장")) {
      const storeChange = payload.changedFacts.find((c) => c.key === "적용 매장")!;
      const drill = payload.unchangedFacts.find((c) => c.key === "모의훈련 주기");
      return {
        ...payload,
        summary: `적용 매장이 ${storeChange.from}에서 ${storeChange.to}로 확대되었으며, 모의훈련 주기는 ${drill?.value ?? "반기 1회"}로 유지되었습니다.`,
      };
    }
    return payload;
  }

  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You summarize ESG year-over-year changes in Korean. Do not invent numbers. Return only a short summary sentence.",
        },
        {
          role: "user",
          content: JSON.stringify({
            // Block-scoped narrative only — never full report PDF/text from client.
            previousNarrative: (previousNarrative ?? "").slice(0, 12000),
            structuredDiff: payload,
          }),
        },
      ],
    });
    const text = response.output_text?.trim();
    if (text) return { ...payload, summary: text };
    return payload;
  } catch {
    return {
      ...payload,
      warnings: [
        ...payload.warnings,
        "OpenAI 호출에 실패하여 규칙 기반 요약을 사용했습니다.",
      ],
    };
  }
}

async function supersedePending(versionId: string, type: AiSuggestionType) {
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    store.ai_suggestions.forEach((s) => {
      if (
        s.content_version_id === versionId &&
        s.suggestion_type === type &&
        s.status === "PENDING"
      ) {
        s.status = "SUPERSEDED";
        s.updated_at = touch();
      }
    });
    return;
  }
  const admin = createSupabaseAdminClient();
  await admin
    .from("ai_suggestions")
    .update({ status: "SUPERSEDED", updated_at: touch() })
    .eq("content_version_id", versionId)
    .eq("suggestion_type", type)
    .eq("status", "PENDING");
}

async function insertSuggestion(suggestion: {
  id: string;
  content_version_id: string;
  suggestion_type: AiSuggestionType;
  status: "PENDING";
  payload: unknown;
  created_by: string;
  created_at: string;
  updated_at: string;
  applied_at: null;
}) {
  if (!isSupabaseConfigured()) {
    getPilotStore().ai_suggestions.push(suggestion as never);
    return suggestion;
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("ai_suggestions")
    .insert(suggestion)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function latestSuggestion(versionId: string, type: AiSuggestionType) {
  if (!isSupabaseConfigured()) {
    return (
      getPilotStore()
        .ai_suggestions.filter(
          (s) => s.content_version_id === versionId && s.suggestion_type === type,
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
    );
  }
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("ai_suggestions")
    .select("*")
    .eq("content_version_id", versionId)
    .eq("suggestion_type", type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function generateChangeSummary(blockId: string) {
  const detail = await getBlockDetail(blockId);
  if (!detail?.current || !detail.previous) {
    throw new Error("이전/현재 버전이 필요합니다.");
  }
  const previousFacts = await getKeyFacts(detail.previous.id);
  const currentFacts = await getKeyFacts(detail.current.id);
  let payload = buildRuleChangeSummary(previousFacts, currentFacts);
  payload = await maybeOpenAISummary(payload, detail.previous.narrative);

  await supersedePending(detail.current.id, "CHANGE_SUMMARY");
  const user = isSupabaseConfigured()
    ? await getSessionUser()
    : getPilotCurrentUser();

  return insertSuggestion({
    id: newId(),
    content_version_id: detail.current.id,
    suggestion_type: "CHANGE_SUMMARY",
    status: "PENDING",
    payload,
    created_by: user.id,
    created_at: touch(),
    updated_at: touch(),
    applied_at: null,
  });
}

export type NarrativePayload = {
  suggestedNarrative: string;
  warnings: string[];
  unsupportedClaims: string[];
};

function factLines(facts: KeyFact[]): string[] {
  return facts.map((f) => `${f.key}: ${factLabel(f)}`);
}

function fallbackNarrativeFromMemo(input: {
  previousNarrative: string;
  changeMemo: string;
}): string {
  const prev = input.previousNarrative.trim();
  const memo = input.changeMemo.trim();
  if (!prev) return memo;
  // Memo already looks like a full replacement draft
  if (memo.length >= Math.max(120, prev.length * 0.6)) return memo;
  return `${prev}\n\n[금년 변경 반영] ${memo}`;
}

async function buildNarrativeFromMemo(input: {
  blockTitle: string;
  reportingYear: number;
  previousNarrative: string;
  changeMemo: string;
  changeSummary: string | null;
  previousFacts: KeyFact[];
  currentFacts: KeyFact[];
  hasEvidence: boolean;
}): Promise<NarrativePayload> {
  const warnings: string[] = [];
  const unsupportedClaims: string[] = [];
  if (!input.hasEvidence) {
    warnings.push(
      "근거 파일이 없어도 생성이 가능합니다. 필요 시 나중에 첨부하세요.",
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes("your-openai")) {
    const suggestedNarrative = fallbackNarrativeFromMemo({
      previousNarrative: input.previousNarrative,
      changeMemo: input.changeMemo,
    });
    return {
      suggestedNarrative,
      warnings: [
        ...warnings,
        "OpenAI 키가 없어 규칙 기반으로 전년 서술에 수정 메모를 반영했습니다.",
      ],
      unsupportedClaims,
    };
  }

  try {
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content: `You update Korean ESG sustainability-report narratives for the current reporting year.
Rules:
1. Start from the previous-year narrative and revise it using the change memo and key-fact diffs.
2. Do not invent facts, activities, or numbers that are not in the inputs.
3. Do not unnecessarily rewrite unchanged sentences.
4. Evidence is optional. Do not append [확인 필요] only because evidence is missing; only mark claims that cannot be supported by the memo/facts.
5. Preserve disclosure tone; output the full updated narrative for ${input.reportingYear}.
6. Return JSON only: {"suggestedNarrative":"","warnings":[],"unsupportedClaims":[]}`,
        },
        {
          role: "user",
          content: JSON.stringify({
            blockTitle: input.blockTitle,
            reportingYear: input.reportingYear,
            previousNarrative: input.previousNarrative.slice(0, 12000),
            changeMemo: input.changeMemo.slice(0, 8000),
            changeSummary: input.changeSummary,
            previousKeyFacts: factLines(input.previousFacts),
            currentKeyFacts: factLines(input.currentFacts),
            hasEvidence: input.hasEvidence,
          }),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const suggested = String(parsed.suggestedNarrative ?? "").trim();
    if (!suggested) {
      throw new Error("empty narrative");
    }
    const aiWarnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.map(String)
      : [];
    const aiUnsupported = Array.isArray(parsed.unsupportedClaims)
      ? parsed.unsupportedClaims.map(String)
      : [];
    return {
      suggestedNarrative: suggested,
      warnings: [...warnings, ...aiWarnings],
      unsupportedClaims: [...unsupportedClaims, ...aiUnsupported],
    };
  } catch {
    const suggestedNarrative = fallbackNarrativeFromMemo({
      previousNarrative: input.previousNarrative,
      changeMemo: input.changeMemo,
    });
    return {
      suggestedNarrative,
      warnings: [
        ...warnings,
        "OpenAI 호출에 실패하여 규칙 기반으로 전년 서술에 수정 메모를 반영했습니다.",
      ],
      unsupportedClaims,
    };
  }
}

/**
 * Build this-year narrative by revising previous-year disclosure with the change memo.
 * Optionally auto-applies to the current content_version.narrative.
 */
export async function generateNarrativeUpdate(
  blockId: string,
  options?: {
    changeMemo?: string | null;
    /** When true (default), write suggested narrative onto current version. */
    apply?: boolean;
  },
) {
  const detail = await getBlockDetail(blockId);
  if (!detail?.current || !detail.previous) {
    throw new Error("이전/현재 버전이 필요합니다.");
  }

  const changeMemo = (
    options?.changeMemo ??
    detail.current.narrative ??
    ""
  ).trim();
  if (!changeMemo) {
    throw new Error(
      "수정 메모가 없습니다. Current Year에 변경 내용을 입력한 뒤 다시 시도하세요.",
    );
  }

  const change = await latestSuggestion(detail.current.id, "CHANGE_SUMMARY");
  const changeSummary =
    change?.payload && typeof change.payload === "object"
      ? String((change.payload as ChangeSummaryPayload).summary ?? "") || null
      : detail.current.change_summary;

  const previousFacts = await getKeyFacts(detail.previous.id);
  const currentFacts = await getKeyFacts(detail.current.id);

  const payload = await buildNarrativeFromMemo({
    blockTitle: detail.block.title,
    reportingYear: detail.current.reporting_year,
    previousNarrative: detail.previous.narrative ?? "",
    changeMemo,
    changeSummary,
    previousFacts,
    currentFacts,
    hasEvidence: detail.evidences.length > 0,
  });

  await supersedePending(detail.current.id, "NARRATIVE_UPDATE");
  const user = isSupabaseConfigured()
    ? await getSessionUser()
    : getPilotCurrentUser();

  const suggestion = await insertSuggestion({
    id: newId(),
    content_version_id: detail.current.id,
    suggestion_type: "NARRATIVE_UPDATE",
    status: "PENDING",
    payload,
    created_by: user.id,
    created_at: touch(),
    updated_at: touch(),
    applied_at: null,
  });

  const shouldApply = options?.apply !== false;
  if (shouldApply) {
    await applySuggestion(suggestion.id);
  }

  return {
    suggestion,
    narrative: payload.suggestedNarrative,
    warnings: payload.warnings,
  };
}


export type EvidenceCheckPayload = {
  checks: Array<{
    claim: string;
    status:
      | "SUPPORTED"
      | "PARTIALLY_SUPPORTED"
      | "NOT_SUPPORTED"
      | "REVIEW_REQUIRED";
    evidenceId: string;
    reason: string;
  }>;
  warnings: string[];
};

export async function generateEvidenceCheck(blockId: string) {
  const detail = await getBlockDetail(blockId);
  if (!detail?.current) throw new Error("현재 버전이 필요합니다.");
  const facts = await getKeyFacts(detail.current.id);
  const evidenceId = detail.evidences[0]?.evidence?.id ?? "";

  const checks = facts.map((f) => ({
    claim: `${f.key} = ${factLabel(f)}`,
    status: (evidenceId
      ? "PARTIALLY_SUPPORTED"
      : "REVIEW_REQUIRED") as EvidenceCheckPayload["checks"][0]["status"],
    evidenceId,
    reason: evidenceId
      ? "연결된 Evidence가 있으나 자동 추출 검증은 MVP에서 부분 지원입니다."
      : "연결된 PRIMARY/SUPPORTING Evidence가 없습니다.",
  }));

  const payload: EvidenceCheckPayload = {
    checks,
    warnings:
      evidenceId.length === 0
        ? ["Evidence 업로드 후 재실행을 권장합니다."]
        : [
            "AI Evidence Check 결과는 참고용이며 승인 결정을 대체하지 않습니다.",
          ],
  };

  await supersedePending(detail.current.id, "EVIDENCE_CHECK");
  const user = isSupabaseConfigured()
    ? await getSessionUser()
    : getPilotCurrentUser();

  return insertSuggestion({
    id: newId(),
    content_version_id: detail.current.id,
    suggestion_type: "EVIDENCE_CHECK",
    status: "PENDING",
    payload,
    created_by: user.id,
    created_at: touch(),
    updated_at: touch(),
    applied_at: null,
  });
}

export async function listSuggestions(blockId: string) {
  const detail = await getBlockDetail(blockId);
  if (!detail?.current) return [];

  if (!isSupabaseConfigured()) {
    return getPilotStore()
      .ai_suggestions.filter((s) => s.content_version_id === detail.current!.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("ai_suggestions")
    .select("*")
    .eq("content_version_id", detail.current.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function applySuggestion(suggestionId: string) {
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const suggestion = store.ai_suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) throw new Error("Suggestion을 찾을 수 없습니다.");
    const version = store.content_versions.find(
      (v) => v.id === suggestion.content_version_id,
    );
    if (!version) throw new Error("버전을 찾을 수 없습니다.");
    const before = { ...version };
    const ts = touch();
    if (suggestion.suggestion_type === "CHANGE_SUMMARY") {
      version.change_summary = (suggestion.payload as ChangeSummaryPayload)
        .summary;
    } else if (suggestion.suggestion_type === "NARRATIVE_UPDATE") {
      version.narrative = (suggestion.payload as NarrativePayload)
        .suggestedNarrative;
    }
    suggestion.status = "APPLIED";
    suggestion.applied_at = ts;
    suggestion.updated_at = ts;
    version.updated_at = ts;
    void writeAuditLog({
      action: "AI_SUGGESTION_APPLY",
      entity_type: "ai_suggestions",
      entity_id: suggestion.id,
      before_data: before,
      after_data: { version, suggestion },
    });
    return suggestion;
  }

  const admin = createSupabaseAdminClient();
  const { data: suggestion, error } = await admin
    .from("ai_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!suggestion) throw new Error("Suggestion을 찾을 수 없습니다.");

  const { data: version, error: vErr } = await admin
    .from("content_versions")
    .select("*")
    .eq("id", suggestion.content_version_id)
    .maybeSingle();
  if (vErr) throw new Error(vErr.message);
  if (!version) throw new Error("버전을 찾을 수 없습니다.");

  const before = { ...version };
  const ts = touch();
  const versionPatch: Record<string, unknown> = { updated_at: ts };

  if (suggestion.suggestion_type === "CHANGE_SUMMARY") {
    versionPatch.change_summary = (suggestion.payload as ChangeSummaryPayload)
      .summary;
  } else if (suggestion.suggestion_type === "NARRATIVE_UPDATE") {
    versionPatch.narrative = (suggestion.payload as NarrativePayload)
      .suggestedNarrative;
  }

  await admin.from("content_versions").update(versionPatch).eq("id", version.id);
  const { data: updated, error: uErr } = await admin
    .from("ai_suggestions")
    .update({ status: "APPLIED", applied_at: ts, updated_at: ts })
    .eq("id", suggestionId)
    .select()
    .single();
  if (uErr) throw new Error(uErr.message);

  await writeAuditLog({
    action: "AI_SUGGESTION_APPLY",
    entity_type: "ai_suggestions",
    entity_id: suggestion.id,
    before_data: before,
    after_data: { version: { ...version, ...versionPatch }, suggestion: updated },
  });

  return updated;
}

export async function rejectSuggestion(suggestionId: string) {
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const suggestion = store.ai_suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) throw new Error("Suggestion을 찾을 수 없습니다.");
    suggestion.status = "REJECTED";
    suggestion.updated_at = touch();
    return suggestion;
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("ai_suggestions")
    .update({ status: "REJECTED", updated_at: touch() })
    .eq("id", suggestionId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSuggestionPayload(
  suggestionId: string,
  payload: Record<string, unknown>,
) {
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    const suggestion = store.ai_suggestions.find((s) => s.id === suggestionId);
    if (!suggestion) throw new Error("Suggestion을 찾을 수 없습니다.");
    if (suggestion.status !== "PENDING") {
      throw new Error("PENDING Suggestion만 수정할 수 있습니다.");
    }
    suggestion.payload = { ...suggestion.payload, ...payload };
    suggestion.updated_at = touch();
    return suggestion;
  }

  const admin = createSupabaseAdminClient();
  const { data: existing, error: fErr } = await admin
    .from("ai_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .maybeSingle();
  if (fErr) throw new Error(fErr.message);
  if (!existing) throw new Error("Suggestion을 찾을 수 없습니다.");
  if (existing.status !== "PENDING") {
    throw new Error("PENDING Suggestion만 수정할 수 있습니다.");
  }

  const { data, error } = await admin
    .from("ai_suggestions")
    .update({
      payload: { ...(existing.payload as object), ...payload },
      updated_at: touch(),
    })
    .eq("id", suggestionId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
