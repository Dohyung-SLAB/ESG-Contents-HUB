"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { actionAssignOwnerDepartment } from "@/lib/actions";
import { ChangeTypeBadge, StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LibraryBlockRow } from "@/lib/services/library";
import { PILOT_DEPARTMENTS } from "@/lib/services/permissions";
import type { ContentBlock, ContentVersion, KeyFact } from "@/types/database";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Detail = {
  block: ContentBlock;
  owner_name: string | null;
  reviewer_name: string | null;
  versions: ContentVersion[];
  current: ContentVersion | null;
  previous: ContentVersion | null;
  current_key_facts: KeyFact[];
  previous_key_facts: KeyFact[];
  evidences: Array<{
    link: { id: string; relationship_type: string };
    evidence: { id: string; filename: string } | null;
  }>;
};

export function LibraryView({
  rows,
  selected,
  canAssignDepartment = false,
}: {
  rows: LibraryBlockRow[];
  selected: Detail | null;
  canAssignDepartment?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [section, setSection] = useState(searchParams.get("section") ?? "");
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [contentType, setContentType] = useState(
    searchParams.get("content_type") ?? "",
  );
  const [updateType, setUpdateType] = useState(
    searchParams.get("update_type") ?? "",
  );
  const [owner, setOwner] = useState(searchParams.get("owner") ?? "");
  const [changeType, setChangeType] = useState(
    searchParams.get("change_type") ?? "",
  );

  const sections = useMemo(
    () => Array.from(new Set(rows.map((r) => r.section).filter(Boolean))),
    [rows],
  );

  function applyFilters(next?: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    const values = {
      q,
      section,
      status,
      content_type: contentType,
      update_type: updateType,
      owner,
      change_type: changeType,
      ...next,
    };
    Object.entries(values).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    router.push(`/library?${params.toString()}`);
  }

  function selectBlock(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("blockId", id);
    router.push(`/library?${params.toString()}`);
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-[220px_1fr_340px] gap-4">
      <aside className="overflow-y-auto rounded-lg border bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Issue Tree
        </p>
        <button
          type="button"
          className={cn(
            "mb-2 w-full rounded-md px-2 py-2 text-left text-sm",
            !section
              ? "bg-[var(--brand-navy)]/10 font-medium text-[var(--brand-navy)]"
              : "text-muted-foreground hover:bg-slate-50",
          )}
          onClick={() => {
            setSection("");
            applyFilters({ section: "" });
          }}
        >
          전체
        </button>
        <ul className="space-y-1">
          {sections.map((s) => (
            <li key={s}>
              <button
                type="button"
                className={cn(
                  "w-full rounded-md px-2 py-1.5 text-left text-sm",
                  section === s
                    ? "bg-slate-100 font-medium"
                    : "text-muted-foreground hover:bg-slate-50",
                )}
                onClick={() => {
                  setSection(s ?? "");
                  applyFilters({ section: s ?? "" });
                }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Input
            placeholder="Search title / sub_topic"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <select
            className="h-8 rounded-md border px-2 text-sm"
            value={contentType}
            onChange={(e) => setContentType(e.target.value)}
          >
            <option value="">Content Type</option>
            {[
              "GOVERNANCE",
              "STRATEGY",
              "RISK_OPPORTUNITY",
              "ACTIVITY",
              "PERFORMANCE",
              "PROCESS",
              "TARGET",
              "CERTIFICATION",
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border px-2 text-sm"
            value={updateType}
            onChange={(e) => setUpdateType(e.target.value)}
          >
            <option value="">Update Type</option>
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
          <Input
            placeholder="Owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="max-w-[140px]"
          />
          <select
            className="h-8 rounded-md border px-2 text-sm"
            value={changeType}
            onChange={(e) => setChangeType(e.target.value)}
          >
            <option value="">Change Type</option>
            {["PENDING", "NO_CHANGE", "MODIFIED", "NEW", "DELETED"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="h-8 rounded-md border px-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Status</option>
            {[
              "NOT_STARTED",
              "IN_PROGRESS",
              "SUBMITTED",
              "UNDER_REVIEW",
              "REVISION_REQUESTED",
              "APPROVED",
            ].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => applyFilters()}>
            Apply
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Content Block</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Content Type</TableHead>
                <TableHead>Dept</TableHead>
              <TableHead>Owner</TableHead>
                <TableHead>Update Type</TableHead>
                <TableHead>Change</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-muted-foreground">
                    No content blocks match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(
                      "cursor-pointer",
                      selected?.block.id === row.id && "bg-slate-50",
                    )}
                    onClick={() => selectBlock(row.id)}
                  >
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell className="font-medium">{row.title}</TableCell>
                    <TableCell>{row.section}</TableCell>
                    <TableCell>{row.content_type}</TableCell>
                    <TableCell>{row.owner_department ?? "—"}</TableCell>
                    <TableCell>{row.owner_name ?? "—"}</TableCell>
                    <TableCell>{row.update_type}</TableCell>
                    <TableCell>
                      <ChangeTypeBadge changeType={row.change_type} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.last_updated).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <aside className="overflow-y-auto rounded-lg border bg-white p-4">
        {!selected ? (
          <p className="text-sm text-muted-foreground">
            Select a content block to view details.
          </p>
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-mono text-xs text-muted-foreground">
                {selected.block.code}
              </p>
              <h2 className="text-lg font-semibold text-[var(--brand-navy)]">
                {selected.block.title}
              </h2>
              <p className="text-muted-foreground">
                {selected.block.section} · {selected.block.sub_topic}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Meta label="Content Type" value={selected.block.content_type} />
              <Meta label="Update Type" value={selected.block.update_type} />
              <Meta
                label="작성 부서"
                value={selected.block.owner_department ?? "—"}
              />
              <Meta label="Owner" value={selected.owner_name ?? "—"} />
              <Meta label="Reviewer" value={selected.reviewer_name ?? "—"} />
              <Meta
                label="Status"
                value={selected.current?.status ?? "—"}
              />
            </div>
            {canAssignDepartment ? (
              <AssignDepartmentForm
                key={selected.block.id}
                blockId={selected.block.id}
                current={selected.block.owner_department}
              />
            ) : null}
            <div>
              <h3 className="mb-1 font-medium">Previous Narrative (2026)</h3>
              <p className="rounded-md bg-slate-50 p-2 text-muted-foreground">
                {selected.previous?.narrative ?? "—"}
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-medium">Current Narrative (2027)</h3>
              <p className="rounded-md bg-slate-50 p-2 text-muted-foreground">
                {selected.current?.narrative ?? "—"}
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-medium">Key Facts</h3>
              <FactList label="2026" facts={selected.previous_key_facts} />
              <FactList label="2027" facts={selected.current_key_facts} />
            </div>
            <div>
              <h3 className="mb-1 font-medium">Evidence</h3>
              {selected.evidences.length === 0 ? (
                <p className="text-muted-foreground">None</p>
              ) : (
                <ul className="space-y-1">
                  {selected.evidences.map(({ evidence, link }) =>
                    evidence ? (
                      <li key={link.id}>
                        {evidence.filename} ({link.relationship_type})
                      </li>
                    ) : null,
                  )}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-1 font-medium">Source</h3>
              <p className="text-muted-foreground">
                {(selected.current ?? selected.previous)?.source_document ?? "—"}{" "}
                / p.
                {(selected.current ?? selected.previous)?.source_page ?? "—"}
              </p>
            </div>
            <div>
              <h3 className="mb-1 font-medium">Version History</h3>
              <ul className="space-y-1">
                {selected.versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2">
                    <span>{v.reporting_year}</span>
                    <StatusBadge status={v.status} />
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href={`/update/${selected.block.code}`}
              className={cn(buttonVariants(), "w-full")}
            >
              Open Annual Update
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function AssignDepartmentForm({
  blockId,
  current,
}: {
  blockId: string;
  current: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [department, setDepartment] = useState(current ?? "품질보증");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <h3 className="mb-2 text-sm font-medium">작성 부서 지정</h3>
      <p className="mb-2 text-xs text-muted-foreground">
        관리자(컨설턴트) 또는 Reviewer(고객사 ESG)가 현업 부서를 지정합니다.
      </p>
      <div className="flex gap-2">
        <select
          className="h-8 flex-1 rounded-md border bg-white px-2 text-sm"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        >
          {PILOT_DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await actionAssignOwnerDepartment({
                  blockId,
                  owner_department: department,
                });
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "저장 실패");
              }
            });
          }}
        >
          저장
        </Button>
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function FactList({ label, facts }: { label: string; facts: KeyFact[] }) {
  return (
    <div className="mb-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {facts.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {facts.map((f) => (
            <li key={f.id}>
              {f.key}: {f.value_text ?? f.value_number}
              {f.unit ? ` ${f.unit}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
