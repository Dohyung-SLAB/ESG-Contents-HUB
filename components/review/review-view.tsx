"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { EvidenceCheckBody } from "@/components/update/annual-update-view";
import { actionReview } from "@/lib/actions";
import { ChangeTypeBadge, StatusBadge } from "@/components/shared/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AiSuggestion, ContentStatus, KeyFact, Review } from "@/types";
import type { UserRole } from "@/types/enums";
import { cn } from "@/lib/utils";

type QueueRow = {
  version: {
    id: string;
    status: ContentStatus;
    change_type: string;
  };
  block: { id: string; code: string; title: string; content_type: string };
  issue: { name: string } | null | undefined;
  owner_name: string | null;
};

type Detail = {
  block: { id: string; code: string; title: string };
  previous: { narrative: string | null } | null;
  current: { narrative: string | null; status: ContentStatus } | null;
  previous_key_facts: KeyFact[];
  current_key_facts: KeyFact[];
  evidences: Array<{
    evidence: { filename: string } | null;
    link: { relationship_type: string };
  }>;
  reviews: Review[];
};

export function ReviewView({
  queue,
  detail,
  role,
  evidenceChecks,
  initialFilters,
}: {
  queue: QueueRow[];
  detail: Detail | null;
  role: UserRole;
  evidenceChecks: AiSuggestion[];
  initialFilters: {
    issue: string;
    owner: string;
    content_type: string;
    status: string;
    change_type: string;
  };
}) {
  const canReview = role === "ADMIN" || role === "REVIEWER";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(initialFilters);

  function applyFilters() {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    router.push(`/review?${params.toString()}`);
  }

  function act(action: "START_REVIEW" | "APPROVE" | "REQUEST_REVISION" | "COMMENT") {
    if (!detail || !canReview) return;
    setError(null);
    startTransition(async () => {
      try {
        await actionReview({
          blockId: detail.block.code,
          action,
          comment: comment || undefined,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "리뷰 액션 실패");
      }
    });
  }

  return (
    <div className="space-y-4">
      {!canReview ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          현재 역할({role})은 리뷰 액션을 수행할 수 없습니다.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-lg border bg-white p-3">
        <input
          className="h-8 rounded-md border px-2 text-sm"
          placeholder="Issue"
          value={filters.issue}
          onChange={(e) => setFilters({ ...filters, issue: e.target.value })}
        />
        <input
          className="h-8 rounded-md border px-2 text-sm"
          placeholder="Owner"
          value={filters.owner}
          onChange={(e) => setFilters({ ...filters, owner: e.target.value })}
        />
        <select
          className="h-8 rounded-md border px-2 text-sm"
          value={filters.content_type}
          onChange={(e) =>
            setFilters({ ...filters, content_type: e.target.value })
          }
        >
          <option value="">Content Type</option>
          {[
            "GOVERNANCE",
            "ACTIVITY",
            "PERFORMANCE",
            "PROCESS",
            "TARGET",
            "CERTIFICATION",
            "STRATEGY",
            "RISK_OPPORTUNITY",
          ].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border px-2 text-sm"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Status</option>
          {["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUESTED"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border px-2 text-sm"
          value={filters.change_type}
          onChange={(e) =>
            setFilters({ ...filters, change_type: e.target.value })
          }
        >
          <option value="">Change Type</option>
          {["PENDING", "NO_CHANGE", "MODIFIED", "NEW", "DELETED"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Button size="sm" onClick={applyFilters}>
          Apply Filters
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No items in review queue.
                  </TableCell>
                </TableRow>
              ) : (
                queue.map((row) => (
                  <TableRow key={row.version.id}>
                    <TableCell>
                      <Link
                        href={`/review?blockId=${row.block.code}`}
                        className="font-mono text-xs text-[var(--brand-navy)] underline"
                      >
                        {row.block.code}
                      </Link>
                    </TableCell>
                    <TableCell>{row.block.title}</TableCell>
                    <TableCell>{row.owner_name ?? "—"}</TableCell>
                    <TableCell>
                      <ChangeTypeBadge
                        changeType={
                          row.version.change_type as
                            | "PENDING"
                            | "NO_CHANGE"
                            | "MODIFIED"
                            | "NEW"
                            | "DELETED"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.version.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <section className="rounded-lg border bg-white p-4">
          {!detail ? (
            <p className="text-sm text-muted-foreground">
              Select a queue item to review.
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <h2 className="text-lg font-semibold text-[var(--brand-navy)]">
                {detail.block.code} · {detail.block.title}
              </h2>
              {error ? <p className="text-destructive">{error}</p> : null}

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <h3 className="mb-1 font-medium">Previous</h3>
                  <p className="rounded bg-slate-50 p-2">
                    {detail.previous?.narrative ?? "—"}
                  </p>
                  <FactDiff
                    previous={detail.previous_key_facts}
                    current={detail.current_key_facts}
                  />
                </div>
                <div>
                  <h3 className="mb-1 font-medium">Proposed</h3>
                  <p className="rounded bg-slate-50 p-2">
                    {detail.current?.narrative ?? "—"}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-1 font-medium">Evidence</h3>
                {detail.evidences.length === 0 ? (
                  <p className="text-muted-foreground">None</p>
                ) : (
                  <ul>
                    {detail.evidences.map((e, i) => (
                      <li key={i}>
                        {e.evidence?.filename} ({e.link.relationship_type})
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {evidenceChecks[0] ? (
                <div>
                  <h3 className="mb-1 font-medium">AI Evidence Check (advisory)</h3>
                  <EvidenceCheckBody payload={evidenceChecks[0].payload} />
                </div>
              ) : null}

              <textarea
                className="min-h-20 w-full rounded-md border p-2"
                placeholder="Reviewer comment"
                value={comment}
                disabled={!canReview}
                onChange={(e) => setComment(e.target.value)}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending || !canReview}
                  onClick={() => act("START_REVIEW")}
                >
                  Start Review
                </Button>
                <Button
                  disabled={pending || !canReview}
                  variant="secondary"
                  onClick={() => act("APPROVE")}
                >
                  Approve
                </Button>
                <Button
                  disabled={pending || !canReview}
                  variant="outline"
                  onClick={() => act("REQUEST_REVISION")}
                >
                  Request Revision
                </Button>
                <Button
                  disabled={pending || !canReview}
                  variant="ghost"
                  onClick={() => act("COMMENT")}
                >
                  Comment
                </Button>
                <Link
                  href={`/update/${detail.block.code}`}
                  className={cn(buttonVariants({ variant: "link" }))}
                >
                  Open Update
                </Link>
              </div>

              <div>
                <h3 className="mb-1 font-medium">Review History</h3>
                <ul className="space-y-1">
                  {detail.reviews.map((r) => (
                    <li key={r.id} className="rounded bg-slate-50 px-2 py-1">
                      {r.action} · {new Date(r.created_at).toLocaleString()}
                      {r.comment ? ` — ${r.comment}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FactDiff({
  previous,
  current,
}: {
  previous: KeyFact[];
  current: KeyFact[];
}) {
  const keys = Array.from(
    new Set([...previous.map((f) => f.key), ...current.map((f) => f.key)]),
  );
  return (
    <ul className="mt-2 space-y-1">
      {keys.map((key) => {
        const p = previous.find((f) => f.key === key);
        const c = current.find((f) => f.key === key);
        const from = p
          ? `${p.value_text ?? p.value_number ?? ""}${p.unit ?? ""}`
          : "—";
        const to = c
          ? `${c.value_text ?? c.value_number ?? ""}${c.unit ?? ""}`
          : "—";
        const changed = from !== to;
        return (
          <li
            key={key}
            className={
              changed ? "font-medium text-blue-800" : "text-muted-foreground"
            }
          >
            {key}: {from} → {to}
          </li>
        );
      })}
    </ul>
  );
}
