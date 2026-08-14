"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  actionApproveCandidate,
  actionDeleteCandidate,
  actionMergeCandidates,
  actionSplitCandidate,
  actionUpdateCandidate,
} from "@/lib/actions";
import { NarrativePreview } from "@/components/extraction/narrative-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExtractionCandidate, ExtractionJob } from "@/types/database";
import type { ExtractionDiagnostics } from "@/lib/services/extraction";

export function ExtractionReviewView({
  job,
  candidates,
  summary,
  diagnostics,
}: {
  job: ExtractionJob;
  candidates: ExtractionCandidate[];
  summary: { total: number; high: number; review: number; attention: number };
  diagnostics?: ExtractionDiagnostics | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(
    candidates[0]?.id ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const active = candidates.find((c) => c.id === activeId) ?? null;

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "요청 실패");
      }
    });
  }

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Total" value={summary.total} />
        <Stat label="High (≥0.90)" value={summary.high} />
        <Stat label="Review (0.75–0.89)" value={summary.review} />
        <Stat label="Attention (<0.75)" value={summary.attention} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {diagnostics ? (
        <section className="rounded-lg border bg-white p-4 text-sm">
          <h3 className="mb-2 font-semibold text-[var(--brand-ink)]">
            감지된 목차 구조
          </h3>
          <p className="mb-2 text-xs text-muted-foreground">
            페이지 {diagnostics.startPage ?? "?"}–{diagnostics.endPage ?? "?"} (
            {diagnostics.pageCount}p) · 한글 {diagnostics.hangulChars}자 ·
            Case 패턴 {diagnostics.hasCasePattern ? "있음" : "없음"} · 아웃라인{" "}
            {diagnostics.outlineSource} · Content 후보{" "}
            {diagnostics.segmentCount}개
          </p>
          {diagnostics.matchedHeading ? (
            <p className="mb-2 text-xs text-muted-foreground">
              매칭 제목: {diagnostics.matchedHeading}
            </p>
          ) : null}
          <p className="mb-2 text-xs text-muted-foreground">
            category = 위계 분류(후보 제외) · content/case/target = 작성 컨텐츠
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {diagnostics.outline.map((item, i) => (
              <li
                key={`${item.title}-${i}`}
                className={item.level > 1 ? "ml-4" : undefined}
              >
                <span
                  className={
                    item.kind === "category"
                      ? "text-muted-foreground"
                      : "font-medium"
                  }
                >
                  {item.title}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {item.kind}
                  {item.parentCategory ? ` · under ${item.parentCategory}` : ""}
                  {item.parentContent ? ` · of ${item.parentContent}` : ""}
                  {item.startPageHint != null
                    ? ` · p.${item.startPageHint}`
                    : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending || selected.length < 2}
          onClick={() => run(() => actionMergeCandidates(selected, job.id))}
        >
          Merge Selected
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !active}
          onClick={() =>
            run(() =>
              actionSplitCandidate(
                active!.id,
                [`${active!.title} (1)`, `${active!.title} (2)`],
                job.id,
              ),
            )
          }
        >
          Split Active
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Suggested Block</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Update</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c) => (
                <TableRow
                  key={c.id}
                  className={activeId === c.id ? "bg-slate-50" : undefined}
                  onClick={() => setActiveId(c.id)}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={() => toggle(c.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell>{c.section}</TableCell>
                  <TableCell>{c.content_type}</TableCell>
                  <TableCell>{c.update_type}</TableCell>
                  <TableCell>{c.source_page}</TableCell>
                  <TableCell>{c.confidence?.toFixed(2)}</TableCell>
                  <TableCell className="space-x-1">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        run(() => actionApproveCandidate(c.id, job.id));
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        run(() => actionDeleteCandidate(c.id, job.id));
                      }}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <aside className="rounded-lg border bg-white p-4 text-sm">
          <h3 className="mb-2 font-semibold">Source Viewer</h3>
          {!active ? (
            <p className="text-muted-foreground">Select a candidate</p>
          ) : (
            <div className="space-y-3">
              <p>
                <span className="text-muted-foreground">Page:</span>{" "}
                {active.source_page}
              </p>
              <p className="whitespace-pre-wrap rounded bg-slate-50 p-2">
                {active.source_text}
              </p>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Rename</span>
                <Input
                  defaultValue={active.title}
                  onBlur={(e) => {
                    if (e.target.value !== active.title) {
                      run(() =>
                        actionUpdateCandidate(
                          active.id,
                          { title: e.target.value },
                          job.id,
                        ),
                      );
                    }
                  }}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">
                  Content Type (제안값 · 컨텐츠 성격에 맞게 수정)
                </span>
                <select
                  className="h-8 w-full rounded-md border px-2 text-sm"
                  value={active.content_type ?? ""}
                  onChange={(e) =>
                    run(() =>
                      actionUpdateCandidate(
                        active.id,
                        {
                          content_type: e.target.value as NonNullable<
                            typeof active.content_type
                          >,
                        },
                        job.id,
                      ),
                    )
                  }
                >
                  {[
                    "POLICY",
                    "GOVERNANCE",
                    "STRATEGY",
                    "RISK_OPPORTUNITY",
                    "TARGET",
                    "ACTIVITY",
                    "PERFORMANCE",
                    "PROCESS",
                    "CERTIFICATION",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Update Type</span>
                <select
                  className="h-8 w-full rounded-md border px-2 text-sm"
                  value={active.update_type ?? ""}
                  onChange={(e) =>
                    run(() =>
                      actionUpdateCandidate(
                        active.id,
                        {
                          update_type: e.target.value as NonNullable<
                            typeof active.update_type
                          >,
                        },
                        job.id,
                      ),
                    )
                  }
                >
                  {[
                    "NARRATIVE",
                    "STRUCTURE",
                    "ACTIVITY",
                    "NUMERIC",
                    "TARGET",
                    "CERTIFICATION",
                  ].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">
                  Narrative (본문 전문 · 표는 Markdown)
                </span>
                <div className="rounded-md border bg-slate-50 p-2">
                  <NarrativePreview narrative={active.narrative ?? ""} />
                </div>
                <textarea
                  className="min-h-48 w-full rounded-md border p-2 font-mono text-xs leading-relaxed"
                  defaultValue={active.narrative ?? ""}
                  onBlur={(e) => {
                    if (e.target.value !== (active.narrative ?? "")) {
                      run(() =>
                        actionUpdateCandidate(
                          active.id,
                          { narrative: e.target.value },
                          job.id,
                        ),
                      );
                    }
                  }}
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Job: {job.original_filename} · {job.status}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold text-[var(--brand-navy)]">{value}</p>
    </div>
  );
}

async function readApiJson(res: Response): Promise<{
  error?: string;
  job?: { id: string };
  storagePath?: string;
  token?: string;
  signedUrl?: string;
}> {
  const text = await res.text();
  try {
    return JSON.parse(text) as {
      error?: string;
      job?: { id: string };
      storagePath?: string;
      token?: string;
      signedUrl?: string;
    };
  } catch {
    const snippet = text.replace(/\s+/g, " ").slice(0, 160);
    // Vercel returns plain text "Request Entity Too Large" when body > ~4.5MB
    if (/entity too large|payload.?too.?large|413/i.test(snippet)) {
      throw new Error(
        "파일이 너무 큽니다. Vercel은 서버로 직접 올리는 요청을 약 4.5MB로 제한합니다. Storage 업로드로 다시 시도하세요.",
      );
    }
    throw new Error(
      snippet
        ? `서버 응답을 읽지 못했습니다: ${snippet}`
        : `요청 실패 (${res.status})`,
    );
  }
}

export function ExtractionCreateForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tocSection, setTocSection] = useState("소비자 신뢰 확보");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            지속가능경영보고서 PDF (최대 50MB)
          </p>
          <Input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            목차명 (TOC section)
          </p>
          <Input
            value={tocSection}
            onChange={(e) => setTocSection(e.target.value)}
            placeholder="예: 소비자 신뢰 확보"
          />
        </div>
      </div>
      <Button
        disabled={pending || !file || !tocSection.trim()}
        onClick={() => {
          if (!file) return;
          setError(null);
          startTransition(async () => {
            try {
              // 1) Signed URL (JSON only) — avoids Vercel 4.5MB body cap
              const prepRes = await fetch("/api/extraction/prepare", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  filename: file.name,
                  byteLength: file.size,
                }),
              });
              const prep = await readApiJson(prepRes);
              if (!prepRes.ok || !prep.storagePath || !prep.token) {
                throw new Error(prep.error ?? `업로드 준비 실패 (${prepRes.status})`);
              }

              // 2) Browser → Supabase Storage (file never goes through Vercel)
              const { createSupabaseBrowserClient } = await import(
                "@/lib/supabase/client"
              );
              const supabase = createSupabaseBrowserClient();
              const { error: upErr } = await supabase.storage
                .from("reports")
                .uploadToSignedUrl(prep.storagePath, prep.token, file, {
                  contentType: "application/pdf",
                });
              if (upErr) {
                throw new Error(upErr.message || "Storage 업로드 실패");
              }

              // 3) Extract from Storage path (small JSON body)
              const res = await fetch("/api/extraction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  storage_path: prep.storagePath,
                  filename: file.name,
                  toc_section: tocSection,
                }),
              });
              const data = await readApiJson(res);
              if (!res.ok || !data.job?.id) {
                throw new Error(data.error ?? `추출 실패 (${res.status})`);
              }
              router.push(`/extraction/${data.job.id}`);
            } catch (e) {
              setError(e instanceof Error ? e.message : "생성 실패");
            }
          });
        }}
      >
        {pending ? "Extracting…" : "Upload & Extract TOC Section"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        PDF는 Supabase Storage로 직접 업로드된 뒤 추출됩니다(Vercel 요청 크기
        제한 회피). 목차 구간을 소제목 단위로 나눈 뒤 Content Block 후보를
        만듭니다. 본문은 전문 보존, 표는 Markdown, 이미지는 제외됩니다.
      </p>
    </div>
  );
}
