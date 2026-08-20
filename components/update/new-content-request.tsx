"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  actionApproveNewContentRequest,
  actionCreateNewContentRequest,
  actionRejectNewContentRequest,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PILOT_DEPARTMENTS } from "@/lib/services/permissions";
import { getNewContentMeta } from "@/lib/services/new-content";
import type { LibraryBlockRow } from "@/lib/services/library";
import type { ContentType, UpdateType, UserRole } from "@/types/enums";
import {
  CONTENT_TYPES,
  UPDATE_TYPES,
} from "@/types/enums";

export function NewContentRequestForm({
  role,
  userDepartment,
  knownSections,
}: {
  role: UserRole;
  userDepartment: string | null;
  knownSections: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [section, setSection] = useState("");
  const [subTopic, setSubTopic] = useState("");
  const [contentType, setContentType] = useState<ContentType>("ACTIVITY");
  const [updateType, setUpdateType] = useState<UpdateType>("NARRATIVE");
  const [department, setDepartment] = useState(
    role === "CONTRIBUTOR" ? userDepartment ?? "" : "",
  );
  const [customDept, setCustomDept] = useState(false);
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        신규 컨텐츠 요청
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--brand-navy)]">
          신규 컨텐츠 요청
        </h3>
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => setOpen(false)}
        >
          닫기
        </button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        전년 보고서에 없던 항목을 요청합니다. 컨설턴트/ESG 승인 후 본문을 작성할 수
        있습니다.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[11px] text-muted-foreground">제목</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 협력사 인권실사 프로세스"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[11px] text-muted-foreground">Section (목차)</span>
          <Input
            list="new-content-sections"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="예: 인권경영 &gt; 거버넌스"
          />
          <datalist id="new-content-sections">
            {knownSections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground">Sub topic (선택)</span>
          <Input
            value={subTopic}
            onChange={(e) => setSubTopic(e.target.value)}
            placeholder="세부 주제"
          />
        </label>
        {role === "CONTRIBUTOR" ? (
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">작성 부서</span>
            <Input value={userDepartment ?? ""} disabled />
          </label>
        ) : (
          <label className="space-y-1">
            <span className="text-[11px] text-muted-foreground">작성 부서</span>
            {customDept ? (
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="부서명 직접 입력"
              />
            ) : (
              <select
                className="h-8 w-full rounded-md border px-2 text-sm"
                value={department}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setCustomDept(true);
                    setDepartment("");
                  } else {
                    setDepartment(e.target.value);
                  }
                }}
              >
                <option value="">선택</option>
                {PILOT_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                <option value="__custom__">직접 입력…</option>
              </select>
            )}
          </label>
        )}
        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground">Content Type</span>
          <select
            className="h-8 w-full rounded-md border px-2 text-sm"
            value={contentType}
            onChange={(e) => setContentType(e.target.value as ContentType)}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[11px] text-muted-foreground">Update Type</span>
          <select
            className="h-8 w-full rounded-md border px-2 text-sm"
            value={updateType}
            onChange={(e) => setUpdateType(e.target.value as UpdateType)}
          >
            {UPDATE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[11px] text-muted-foreground">
            요청 사유 (선택)
          </span>
          <textarea
            className="min-h-20 w-full rounded-md border p-2 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="왜 올해 신규로 필요한지 짧게 적어 주세요."
          />
        </label>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                const result = await actionCreateNewContentRequest({
                  title,
                  section,
                  sub_topic: subTopic.trim() || null,
                  content_type: contentType,
                  update_type: updateType,
                  owner_department:
                    role === "CONTRIBUTOR" ? userDepartment : department,
                  request_note: note.trim() || null,
                });
                setOpen(false);
                setTitle("");
                setSection("");
                setSubTopic("");
                setNote("");
                router.push(`/update/${result.code}`);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "요청 실패");
              }
            });
          }}
        >
          요청 제출
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          취소
        </Button>
      </div>
    </div>
  );
}

export function PendingNewContentQueue({
  rows,
  canApprove,
}: {
  rows: LibraryBlockRow[];
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const pendingRows = rows.filter((r) => {
    const meta = getNewContentMeta(r);
    return r.is_active && meta?.request_status === "PENDING_APPROVAL";
  });

  if (pendingRows.length === 0) return null;

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <h3 className="mb-1 text-sm font-semibold text-[var(--brand-navy)]">
        신규 컨텐츠 승인 대기 ({pendingRows.length})
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        {canApprove
          ? "승인하면 해당 부서가 본문 작성을 시작할 수 있습니다."
          : "컨설턴트/ESG 승인 후 작성이 가능합니다."}
      </p>
      {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
      <ul className="space-y-2">
        {pendingRows.map((row) => {
          const meta = getNewContentMeta(row);
          return (
            <li
              key={row.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.code}
                  </span>{" "}
                  {row.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.section}
                  {row.owner_department ? ` · ${row.owner_department}` : ""}
                </p>
                {meta?.request_note ? (
                  <p className="mt-1 text-xs text-[var(--brand-ink)]">
                    {meta.request_note}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1">
                {canApprove ? (
                  <>
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        setError(null);
                        startTransition(async () => {
                          try {
                            await actionApproveNewContentRequest(row.id);
                            router.refresh();
                          } catch (e) {
                            setError(
                              e instanceof Error ? e.message : "승인 실패",
                            );
                          }
                        });
                      }}
                    >
                      승인
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        const reason = window.prompt("반려 사유 (선택)") ?? "";
                        setError(null);
                        startTransition(async () => {
                          try {
                            await actionRejectNewContentRequest(
                              row.id,
                              reason.trim() || null,
                            );
                            router.refresh();
                          } catch (e) {
                            setError(
                              e instanceof Error ? e.message : "반려 실패",
                            );
                          }
                        });
                      }}
                    >
                      반려
                    </Button>
                  </>
                ) : (
                  <span className="rounded bg-amber-100 px-2 py-1 text-[11px] text-amber-900">
                    승인 대기
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
