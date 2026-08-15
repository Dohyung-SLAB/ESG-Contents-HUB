"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  actionApplySuggestion,
  actionEditSuggestion,
  actionGenerateChangeSummary,
  actionGenerateEvidenceCheck,
  actionGenerateNarrative,
  actionRejectSuggestion,
  actionSaveDraft,
  actionUploadEvidence,
} from "@/lib/actions";
import { ChangeTypeBadge, StatusBadge } from "@/components/shared/status-badge";
import {
  type FactDraft,
  UpdateTypeForm,
} from "@/components/update/update-type-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChangeType, EvidenceRelationshipType, UserRole } from "@/types/enums";
import type { AiSuggestion, ContentBlock, ContentVersion, KeyFact } from "@/types/database";

type Detail = {
  block: ContentBlock;
  current: ContentVersion | null;
  previous: ContentVersion | null;
  current_key_facts: KeyFact[];
  previous_key_facts: KeyFact[];
  evidences: Array<{
    link: { id: string; relationship_type: string };
    evidence: { id: string; filename: string } | null;
  }>;
};

const ALLOWED_EXT = ["pdf", "docx", "xlsx", "pptx", "csv", "png", "jpg", "jpeg", "gif", "webp"];

export function AnnualUpdateView({
  detail,
  suggestions,
  role,
  canEdit: canEditProp,
  userDepartment,
  previousEvidences,
}: {
  detail: Detail;
  suggestions: AiSuggestion[];
  role: UserRole;
  canEdit?: boolean;
  userDepartment?: string | null;
  previousEvidences: Array<{ filename: string; relationship_type: string }>;
}) {
  const canEdit =
    canEditProp ?? (role === "ADMIN" || role === "CONTRIBUTOR");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [changeType, setChangeType] = useState<ChangeType>(
    detail.current?.change_type === "PENDING"
      ? "MODIFIED"
      : (detail.current?.change_type ?? "MODIFIED"),
  );
  const [notes, setNotes] = useState("");
  const [narrative, setNarrative] = useState(detail.current?.narrative ?? "");
  const [relationship, setRelationship] =
    useState<EvidenceRelationshipType>("SUPPORTING");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setNarrative(detail.current?.narrative ?? "");
    setChangeType(
      detail.current?.change_type === "PENDING"
        ? "MODIFIED"
        : (detail.current?.change_type ?? "MODIFIED"),
    );
  }, [
    detail.current?.id,
    detail.current?.narrative,
    detail.current?.change_type,
    detail.current?.updated_at,
  ]);

  const initialFacts: FactDraft[] = useMemo(() => {
    const source =
      detail.current_key_facts.length > 0
        ? detail.current_key_facts
        : detail.previous_key_facts;
    if (detail.block.code === "CT-006" && source.length === 0) {
      return [
        {
          key: "적용 매장",
          value_text: "",
          value_number: "188",
          unit: "개",
          value_type: "NUMBER",
        },
        {
          key: "모의훈련 주기",
          value_text: "반기 1회",
          value_number: "",
          unit: "",
          value_type: "FREQUENCY",
        },
      ];
    }
    return source.map((f) => ({
      key: f.key,
      value_text: f.value_text ?? "",
      value_number: f.value_number != null ? String(f.value_number) : "",
      unit: f.unit ?? "",
      value_type: f.value_type,
    }));
  }, [detail]);

  const [facts, setFacts] = useState<FactDraft[]>(initialFacts);

  useEffect(() => {
    setFacts(initialFacts);
  }, [initialFacts]);

  function run(action: () => Promise<unknown>, okMessage: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        setMessage(okMessage);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "요청 처리 중 오류가 발생했습니다.");
      }
    });
  }

  function changeMemoText() {
    // Prefer the change memo field; fall back to draft narrative if memo empty
    return (notes.trim() || narrative.trim());
  }

  function toPayload() {
    return {
      blockId: detail.block.code,
      change_type: changeType,
      // Prefer updated narrative result; keep memo only as fallback before generate
      narrative: narrative.trim() || notes.trim() || null,
      key_facts: facts.map((f, i) => ({
        key: f.key,
        value_text: f.value_text || null,
        value_number: f.value_number ? Number(f.value_number) : null,
        unit: f.unit || null,
        value_type: f.value_type,
        display_order: i + 1,
      })),
    };
  }

  function uploadFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.includes(ext)) {
      setError(`지원하지 않는 파일 형식입니다: .${ext}`);
      return;
    }
    if (!detail.current) return;
    run(async () => {
      const prepRes = await fetch("/api/evidence/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          byteLength: file.size,
          content_version_id: detail.current!.id,
        }),
      });
      const prepText = await prepRes.text();
      let prep: {
        error?: string;
        storagePath?: string;
        token?: string;
        evidenceId?: string;
      };
      try {
        prep = JSON.parse(prepText) as typeof prep;
      } catch {
        throw new Error(
          prepText.slice(0, 160) || `업로드 준비 실패 (${prepRes.status})`,
        );
      }
      if (!prepRes.ok || !prep.storagePath || !prep.token) {
        throw new Error(prep.error ?? `업로드 준비 실패 (${prepRes.status})`);
      }

      const { createSupabaseBrowserClient } = await import(
        "@/lib/supabase/client"
      );
      const supabase = createSupabaseBrowserClient();
      const { error: upErr } = await supabase.storage
        .from("evidences")
        .uploadToSignedUrl(prep.storagePath, prep.token, file);
      if (upErr) {
        throw new Error(upErr.message || "Storage 업로드 실패");
      }

      await actionUploadEvidence({
        filename: file.name,
        content_version_id: detail.current!.id,
        relationship_type: relationship,
        document_type: ext.toUpperCase(),
        storage_path: prep.storagePath,
        evidence_id: prep.evidenceId,
      });
    }, `Evidence uploaded: ${file.name}`);
  }

  const latest = (type: AiSuggestion["suggestion_type"]) =>
    suggestions.find((s) => s.suggestion_type === type && s.status !== "SUPERSEDED") ??
    null;

  const changeSuggestion = latest("CHANGE_SUMMARY");
  const narrativeSuggestion = latest("NARRATIVE_UPDATE");
  const evidenceCheck = latest("EVIDENCE_CHECK");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={detail.current?.status ?? "NOT_STARTED"} />
        <ChangeTypeBadge changeType={changeType} />
        <span className="text-sm text-muted-foreground">
          {detail.block.code} · {detail.block.title} · {detail.block.update_type}
        </span>
      </div>

      {!canEdit ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {role === "CONTRIBUTOR"
            ? `자기 부서(${userDepartment ?? "미설정"})에 지정된 컨텐츠만 수정할 수 있습니다. 현재 작성 부서: ${detail.block.owner_department ?? "미지정"}`
            : `현재 역할(${role})은 업데이트를 저장할 수 없습니다. Reviewer는 검토만 하며, 작성 부서 지정은 Library에서 가능합니다.`}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--brand-navy)]">
            Previous Year ({detail.previous?.reporting_year ?? "—"})
          </h2>
          <p className="mb-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">
            {detail.previous?.narrative ?? "—"}
          </p>
          <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Key Facts
          </h3>
          <ul className="mb-3 space-y-1 text-sm">
            {detail.previous_key_facts.map((f) => (
              <li key={f.id}>
                {f.key}: {f.value_text ?? f.value_number}
                {f.unit ? ` ${f.unit}` : ""}
              </li>
            ))}
          </ul>
          <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Previous Evidence
          </h3>
          {previousEvidences.length === 0 ? (
            <p className="mb-3 text-sm text-muted-foreground">None</p>
          ) : (
            <ul className="mb-3 space-y-1 text-sm">
              {previousEvidences.map((e) => (
                <li key={`${e.filename}-${e.relationship_type}`}>
                  {e.filename} ({e.relationship_type})
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Source: {detail.previous?.source_document ?? "—"} / p.
            {detail.previous?.source_page ?? "—"}
          </p>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--brand-navy)]">
            Current Year Update ({detail.current?.reporting_year ?? "—"})
          </h2>

          <div className="mb-3 space-y-2">
            <Label>Change Type</Label>
            <select
              className="h-9 w-full rounded-md border px-2 text-sm"
              value={changeType}
              disabled={!canEdit}
              onChange={(e) => setChangeType(e.target.value as ChangeType)}
            >
              <option value="NO_CHANGE">변경 없음 (NO_CHANGE)</option>
              <option value="MODIFIED">수정 (MODIFIED)</option>
              <option value="NEW">신규 (NEW)</option>
              <option value="DELETED">삭제 검토 (DELETED)</option>
            </select>
          </div>

          <div className="mb-3">
            <Label className="mb-2 block">Update Form</Label>
            <UpdateTypeForm
              updateType={detail.block.update_type}
              formSchema={detail.block.form_schema}
              facts={facts}
              onChange={setFacts}
              notes={notes}
              onNotes={setNotes}
              narrative={narrative}
              onNarrative={setNarrative}
              canEdit={canEdit}
            />
          </div>

          {detail.block.update_type !== "NARRATIVE" ? (
            <div className="mb-3 space-y-2">
              <Label>Optional narrative draft (AI Apply target)</Label>
              <textarea
                className="min-h-20 w-full rounded-md border p-2 text-sm"
                value={narrative}
                disabled={!canEdit}
                onChange={(e) => setNarrative(e.target.value)}
              />
            </div>
          ) : null}

          <div
            className={`mb-4 space-y-2 rounded-md border border-dashed p-3 ${
              dragOver ? "border-[var(--brand-navy)] bg-slate-50" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) uploadFile(file);
            }}
          >
            <Label>Evidence upload (drag & drop or select)</Label>
            <select
              className="h-8 w-full rounded-md border px-2 text-sm"
              value={relationship}
              disabled={!canEdit}
              onChange={(e) =>
                setRelationship(e.target.value as EvidenceRelationshipType)
              }
            >
              <option value="PRIMARY">PRIMARY</option>
              <option value="SUPPORTING">SUPPORTING</option>
              <option value="REFERENCE">REFERENCE</option>
            </select>
            <Input
              type="file"
              disabled={!canEdit || pending}
              accept=".pdf,.docx,.xlsx,.pptx,.csv,image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }}
            />
            <p className="text-xs text-muted-foreground">
              PDF, DOCX, XLSX, PPTX, CSV, images — 파일은 Supabase Storage로 직접
              업로드됩니다 (서버 body 미통과).
            </p>
            <ul className="text-xs text-muted-foreground">
              {detail.evidences.map(({ evidence, link }) =>
                evidence ? (
                  <li key={link.id}>
                    {evidence.filename} ({link.relationship_type})
                  </li>
                ) : null,
              )}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={pending || !canEdit}
              onClick={() => run(() => actionSaveDraft(toPayload()), "Draft saved")}
            >
              Save Draft
            </Button>
            <Button
              variant="secondary"
              disabled={pending || !canEdit}
              onClick={() =>
                run(
                  () => actionSaveDraft({ ...toPayload(), submit: true }),
                  "Submitted for review",
                )
              }
            >
              Submit
            </Button>
          </div>
        </section>
      </div>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold">AI Assist</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Narrative는 Current Year에 입력한 수정 메모를 기준으로 전년 서술을
          고쳐 올해 본문에 반영합니다. (생성 시 자동 저장)
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pending || !canEdit}
            onClick={() =>
              run(
                () => actionGenerateChangeSummary(detail.block.code),
                "Change summary generated",
              )
            }
          >
            Generate / Regenerate Change Summary
          </Button>
          <Button
            variant="outline"
            disabled={pending || !canEdit}
            onClick={() =>
              run(async () => {
                const memo = changeMemoText();
                if (!memo) {
                  throw new Error(
                    "수정 메모를 먼저 입력하세요. (서술형 변경 메모 또는 Optional narrative draft)",
                  );
                }
                // Persist memo + facts first so server/AI see the same draft
                await actionSaveDraft(toPayload());
                const result = await actionGenerateNarrative(
                  detail.block.code,
                  memo,
                );
                if (result?.narrative) {
                  setNarrative(result.narrative);
                }
              }, "전년 서술에 수정 메모를 반영해 올해 서술로 저장했습니다")
            }
          >
            Generate / Regenerate Narrative
          </Button>
          <Button
            variant="outline"
            disabled={pending || !canEdit}
            onClick={() =>
              run(
                () => actionGenerateEvidenceCheck(detail.block.code),
                "Evidence check generated",
              )
            }
          >
            Evidence Check
          </Button>
        </div>

        {changeSuggestion ? (
          <SuggestionCard
            title="Change Summary"
            suggestion={changeSuggestion}
            pending={pending}
            canEdit={canEdit}
            editableKey="summary"
            onApply={() =>
              run(
                () => actionApplySuggestion(changeSuggestion.id, detail.block.code),
                "Change summary applied",
              )
            }
            onReject={() =>
              run(
                () => actionRejectSuggestion(changeSuggestion.id, detail.block.code),
                "Suggestion rejected",
              )
            }
            onEdit={(value) =>
              run(
                () =>
                  actionEditSuggestion(changeSuggestion.id, detail.block.code, {
                    summary: value,
                  }),
                "Suggestion edited",
              )
            }
          />
        ) : null}

        {narrativeSuggestion ? (
          <SuggestionCard
            title="Narrative Suggestion"
            suggestion={narrativeSuggestion}
            pending={pending}
            canEdit={canEdit}
            editableKey="suggestedNarrative"
            onApply={() =>
              run(async () => {
                const applied = await actionApplySuggestion(
                  narrativeSuggestion.id,
                  detail.block.code,
                );
                const text = String(
                  (applied?.payload as { suggestedNarrative?: string } | null)
                    ?.suggestedNarrative ?? "",
                );
                if (text) {
                  setNarrative(text);
                }
              }, "Narrative applied")
            }
            onReject={() =>
              run(
                () =>
                  actionRejectSuggestion(narrativeSuggestion.id, detail.block.code),
                "Suggestion rejected",
              )
            }
            onEdit={(value) =>
              run(
                () =>
                  actionEditSuggestion(narrativeSuggestion.id, detail.block.code, {
                    suggestedNarrative: value,
                  }),
                "Suggestion edited",
              )
            }
          />
        ) : null}

        {evidenceCheck ? (
          <div className="mb-4 rounded-md border p-3">
            <h3 className="mb-2 text-sm font-medium">
              Evidence Check · {evidenceCheck.status}
            </h3>
            <EvidenceCheckBody payload={evidenceCheck.payload} />
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SuggestionCard({
  title,
  suggestion,
  editableKey,
  pending,
  canEdit,
  onApply,
  onReject,
  onEdit,
}: {
  title: string;
  suggestion: AiSuggestion;
  editableKey: string;
  pending: boolean;
  canEdit: boolean;
  onApply: () => void;
  onReject: () => void;
  onEdit: (value: string) => void;
}) {
  const value = String(
    (suggestion.payload as Record<string, unknown>)[editableKey] ?? "",
  );
  const [draft, setDraft] = useState(value);

  return (
    <div className="mb-4 rounded-md border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          {title} · {suggestion.status}
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !canEdit || suggestion.status !== "PENDING"}
            onClick={() => onEdit(draft)}
          >
            Save Edit
          </Button>
          <Button
            size="sm"
            disabled={pending || !canEdit || suggestion.status === "APPLIED"}
            onClick={onApply}
          >
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !canEdit}
            onClick={onReject}
          >
            Reject
          </Button>
        </div>
      </div>
      <textarea
        className="min-h-24 w-full rounded-md border p-2 text-sm"
        value={draft}
        disabled={!canEdit || suggestion.status !== "PENDING"}
        onChange={(e) => setDraft(e.target.value)}
      />
    </div>
  );
}

export function EvidenceCheckBody({ payload }: { payload: Record<string, unknown> }) {
  const checks = (payload.checks as Array<{
    claim: string;
    status: string;
    reason: string;
  }>) ?? [];
  const warnings = (payload.warnings as string[]) ?? [];
  return (
    <ul className="space-y-2 text-sm">
      {checks.map((c) => (
        <li key={c.claim} className="rounded-md bg-slate-50 p-2">
          <p className="font-medium">
            {c.status === "SUPPORTED"
              ? "✓"
              : c.status === "REVIEW_REQUIRED"
                ? "⚠"
                : "•"}{" "}
            {c.status}: {c.claim}
          </p>
          <p className="text-muted-foreground">{c.reason}</p>
        </li>
      ))}
      {warnings.map((w) => (
        <li key={w} className="text-amber-700">
          {w}
        </li>
      ))}
    </ul>
  );
}
