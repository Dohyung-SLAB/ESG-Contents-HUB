"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { actionUpdateConsultantGuides } from "@/lib/actions";
import { getConsultantGuides } from "@/lib/consultant-guides";
import { Button } from "@/components/ui/button";
import type { ContentBlock } from "@/types/database";
import type { UserRole } from "@/types/enums";

/** Consultant writes disclosure/evaluation guides; field teams read them. */
export function ConsultantGuidesPanel({
  block,
  role,
}: {
  block: ContentBlock;
  role: UserRole;
}) {
  const router = useRouter();
  const canEdit = role === "ADMIN";
  const initial = getConsultantGuides(block);
  const [disclosure, setDisclosure] = useState(initial.disclosure);
  const [evaluation, setEvaluation] = useState(initial.evaluation);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const next = getConsultantGuides(block);
    setDisclosure(next.disclosure);
    setEvaluation(next.evaluation);
  }, [block.id, block.updated_at, block.form_schema]);

  const hasContent =
    disclosure.trim().length > 0 || evaluation.trim().length > 0;

  if (!canEdit && !hasContent) {
    return (
      <section className="rounded-lg border border-dashed bg-white p-3">
        <h2 className="mb-1 text-base font-semibold text-[var(--brand-navy)]">
          공시·평가 가이드
        </h2>
        <p className="text-xs text-muted-foreground">
          컨설턴트가 아직 가이드를 작성하지 않았습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[var(--brand-navy)]/20 bg-[#f7f8fb] p-3">
      <h2 className="mb-1 text-base font-semibold text-[var(--brand-navy)]">
        공시·평가 가이드
      </h2>
      <p className="mb-3 text-xs text-muted-foreground">
        {canEdit
          ? "현업이 Annual Update를 작성할 때 참고할 공시·평가 가이드를 적어 주세요."
          : "컨설턴트가 남긴 공시·평가 작성 가이드입니다. 본문·증빙 작성 시 참고하세요."}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-[var(--brand-navy)]">
            공시 가이드 (KSSB / GRI / SASB 등)
          </span>
          {canEdit ? (
            <textarea
              className="min-h-28 w-full rounded-md border bg-white p-2 text-sm leading-relaxed"
              value={disclosure}
              onChange={(e) => setDisclosure(e.target.value)}
              placeholder="예: GRI 403 관련 거버넌스·프로세스·성과 지표를 포함해 주세요."
            />
          ) : (
            <div className="min-h-20 whitespace-pre-wrap rounded-md border bg-white p-2 text-sm leading-relaxed text-[var(--brand-ink)]">
              {disclosure.trim() || "—"}
            </div>
          )}
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-medium text-[var(--brand-navy)]">
            평가 가이드 (KCGS / MSCI / DJSI 등)
          </span>
          {canEdit ? (
            <textarea
              className="min-h-28 w-full rounded-md border bg-white p-2 text-sm leading-relaxed"
              value={evaluation}
              onChange={(e) => setEvaluation(e.target.value)}
              placeholder="예: MSCI 보건·안전 지표에 맞춰 정량 실적과 전년 대비 변화를 명시해 주세요."
            />
          ) : (
            <div className="min-h-20 whitespace-pre-wrap rounded-md border bg-white p-2 text-sm leading-relaxed text-[var(--brand-ink)]">
              {evaluation.trim() || "—"}
            </div>
          )}
        </label>
      </div>

      {canEdit ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              setError(null);
              setMessage(null);
              startTransition(async () => {
                try {
                  await actionUpdateConsultantGuides(block.id, {
                    disclosure,
                    evaluation,
                  });
                  setMessage("가이드를 저장했습니다.");
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "저장 실패");
                }
              });
            }}
          >
            가이드 저장
          </Button>
          {message ? (
            <span className="text-xs text-emerald-700">{message}</span>
          ) : null}
          {error ? (
            <span className="text-xs text-destructive">{error}</span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
