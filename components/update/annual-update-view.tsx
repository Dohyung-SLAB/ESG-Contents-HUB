"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  actionGenerateNarrative,
  actionSaveDraft,
  actionUploadEvidence,
} from "@/lib/actions";
import { NarrativePreview } from "@/components/extraction/narrative-preview";
import { SourcePagePreview } from "@/components/extraction/source-page-preview";
import { FrameworkTagsEditor } from "@/components/shared/framework-tags";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  canEditUpdateMaterials,
  canUseAiNarrativeRevision,
} from "@/lib/services/permissions";
import type { UserRole } from "@/types/enums";
import type { ContentBlock, ContentVersion, KeyFact } from "@/types/database";

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

const ALLOWED_EXT = [
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "csv",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
];

export function AnnualUpdateView({
  detail,
  role,
  canEdit: canEditProp,
  userDepartment,
}: {
  detail: Detail;
  suggestions: unknown;
  role: UserRole;
  canEdit?: boolean;
  userDepartment?: string | null;
  previousEvidences: Array<{ filename: string; relationship_type: string }>;
}) {
  const canEditBlock =
    canEditProp ?? (role === "ADMIN" || role === "CONTRIBUTOR");
  const canEditMaterials = canEditUpdateMaterials(role, canEditBlock);
  const canUseAi = canUseAiNarrativeRevision(role);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [memo, setMemo] = useState(detail.current?.change_summary ?? "");
  const [report, setReport] = useState(detail.current?.narrative ?? "");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setReport(detail.current?.narrative ?? "");
    setMemo(detail.current?.change_summary ?? "");
  }, [
    detail.current?.id,
    detail.current?.narrative,
    detail.current?.change_summary,
    detail.current?.updated_at,
  ]);

  const keyFactsPayload = useMemo(() => {
    const source =
      detail.current_key_facts.length > 0
        ? detail.current_key_facts
        : detail.previous_key_facts;
    return source.map((f, i) => ({
      key: f.key,
      value_text: f.value_text ?? null,
      value_number: f.value_number ?? null,
      unit: f.unit ?? null,
      value_type: f.value_type,
      display_order: f.display_order ?? i + 1,
    }));
  }, [detail.current_key_facts, detail.previous_key_facts]);

  function run(action: () => Promise<unknown>, okMessage: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        setMessage(okMessage);
        router.refresh();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "요청 처리 중 오류가 발생했습니다.",
        );
      }
    });
  }

  function toPayload(submit = false) {
    const changeMemo = memo.trim();
    return {
      blockId: detail.block.code,
      change_type: "MODIFIED" as const,
      narrative: canUseAi
        ? report.trim() || changeMemo || null
        : report.trim() || null,
      change_summary: changeMemo || null,
      key_facts: keyFactsPayload,
      submit,
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
        relationship_type: "SUPPORTING",
        document_type: ext.toUpperCase(),
        storage_path: prep.storagePath,
        evidence_id: prep.evidenceId,
      });
    }, `근거 파일을 첨부했습니다: ${file.name}`);
  }

  const attached = detail.evidences.filter((e) => e.evidence);

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={detail.current?.status ?? "NOT_STARTED"} />
        <span className="text-sm text-muted-foreground">
          {detail.block.code} · {detail.block.title}
        </span>
        {canUseAi ? (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-muted-foreground">
            컨설턴트 · AI 서술 개정 가능
          </span>
        ) : (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-muted-foreground">
            수정 메모 · 근거 첨부
          </span>
        )}
      </div>

      <FrameworkTagsEditor
        blockId={detail.block.id}
        esgFrameworks={detail.block.esg_frameworks}
        disclosureFrameworks={detail.block.disclosure_frameworks}
        editable={canEditMaterials}
      />

      {!canEditMaterials ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {role === "CONTRIBUTOR"
            ? `자기 부서(${userDepartment ?? "미설정"})에 지정된 컨텐츠만 수정할 수 있습니다. 현재 작성 부서: ${detail.block.owner_department ?? "미지정"}`
            : `현재 역할(${role})은 업데이트를 저장할 수 없습니다.`}
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

      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-1 text-base font-semibold text-[var(--brand-navy)]">
          작년 보고서
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {detail.previous?.reporting_year ?? "—"}년 서술 · 참고용
        </p>
        <div className="max-h-64 overflow-y-auto rounded-md bg-slate-50 p-3 text-sm leading-relaxed">
          {detail.previous?.narrative?.trim() ? (
            <NarrativePreview narrative={detail.previous.narrative} />
          ) : (
            "작년 서술이 없습니다."
          )}
        </div>
        <div className="mt-3">
          <SourcePagePreview
            storagePath={
              typeof detail.block.form_schema?.source_pdf_path === "string"
                ? detail.block.form_schema.source_pdf_path
                : null
            }
            page={
              (typeof detail.block.form_schema?.source_page === "number"
                ? detail.block.form_schema.source_page
                : null) ?? detail.previous?.source_page
            }
          />
        </div>
      </section>

      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-1 text-base font-semibold text-[var(--brand-navy)]">
          수정 메모
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          전년 대비 바뀐 내용만 적어 주세요. (전문 재작성 불필요)
        </p>
        <textarea
          className="min-h-28 w-full rounded-md border p-3 text-sm"
          value={memo}
          disabled={!canEditMaterials}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예: 탄소중립추진위원회를 설립하여 에너지 관리 체계를 정비"
        />
      </section>

      <section
        className={`rounded-lg border border-dashed bg-white p-3 ${
          dragOver ? "border-[var(--brand-navy)] bg-slate-50" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!canEditMaterials) return;
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!canEditMaterials) return;
          const file = e.dataTransfer.files?.[0];
          if (file) uploadFile(file);
        }}
      >
        <h2 className="mb-1 text-base font-semibold text-[var(--brand-navy)]">
          관련 근거 첨부
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          선택 사항입니다. 파일을 첨부하거나 아래 목록에서 확인할 수 있습니다.
        </p>
        <Input
          type="file"
          disabled={!canEditMaterials || pending}
          accept=".pdf,.docx,.xlsx,.pptx,.csv,image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
        />
        {attached.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {attached.map(({ evidence, link }) =>
              evidence ? (
                <li key={link.id}>{evidence.filename}</li>
              ) : null,
            )}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">첨부된 파일 없음</p>
        )}
      </section>

      {canUseAi ? (
        <section className="rounded-lg border bg-white p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[var(--brand-navy)]">
                올해 보고서 초안 (AI 서술 개정)
              </h2>
              <p className="text-xs text-muted-foreground">
                컨설턴트 전용 · 작년 보고서 + 수정 메모로 서술을 생성합니다
              </p>
            </div>
            <Button
              disabled={pending || !canEditMaterials}
              onClick={() =>
                run(async () => {
                  const changeMemo = memo.trim();
                  if (!changeMemo) {
                    throw new Error("수정 메모를 먼저 작성해 주세요.");
                  }
                  await actionSaveDraft({
                    ...toPayload(false),
                    narrative: changeMemo,
                    change_summary: changeMemo,
                  });
                  const result = await actionGenerateNarrative(
                    detail.block.code,
                    changeMemo,
                  );
                  if (result?.narrative) {
                    setReport(result.narrative);
                  }
                }, "보고서를 생성해 저장했습니다")
              }
            >
              {pending ? "생성 중…" : "보고서 생성"}
            </Button>
          </div>
          <Label className="mb-1 block text-xs text-muted-foreground">
            생성 결과 (직접 수정 가능)
          </Label>
          <textarea
            className="min-h-48 w-full rounded-md border p-3 text-sm leading-relaxed"
            value={report}
            disabled={!canEditMaterials}
            onChange={(e) => setReport(e.target.value)}
            placeholder="「보고서 생성」을 누르면 여기에 결과가 나타납니다"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={pending || !canEditMaterials || !report.trim()}
              onClick={() =>
                run(
                  () => actionSaveDraft(toPayload(false)),
                  "초안을 저장했습니다",
                )
              }
            >
              초안 저장
            </Button>
            <Button
              variant="secondary"
              disabled={
                pending || !canEditBlock || !report.trim()
              }
              onClick={() =>
                run(
                  () => actionSaveDraft(toPayload(true)),
                  "검토 요청을 제출했습니다",
                )
              }
            >
              제출
            </Button>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border bg-white p-3">
          <h2 className="mb-1 text-base font-semibold text-[var(--brand-navy)]">
            메모 · 근거 저장
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            AI 서술 개정은 컨설턴트만 사용합니다. 여기서는 수정 메모와 근거를
            저장·제출할 수 있습니다.
          </p>
          {report.trim() ? (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                현재 저장된 서술 (읽기 전용)
              </p>
              <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-relaxed">
                {report}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={pending || !canEditMaterials || !memo.trim()}
              onClick={() =>
                run(
                  () => actionSaveDraft(toPayload(false)),
                  "수정 메모를 저장했습니다",
                )
              }
            >
              메모 저장
            </Button>
            {canEditBlock ? (
              <Button
                variant="secondary"
                disabled={pending || !memo.trim()}
                onClick={() =>
                  run(
                    () => actionSaveDraft(toPayload(true)),
                    "검토 요청을 제출했습니다",
                  )
                }
              >
                제출
              </Button>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
