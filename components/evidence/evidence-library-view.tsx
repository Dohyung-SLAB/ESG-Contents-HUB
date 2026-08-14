"use client";

import { useState, useTransition } from "react";

import {
  actionDeleteEvidence,
  actionLinkEvidence,
  actionUnlinkEvidence,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type EvidenceRow = {
  id: string;
  filename: string;
  document_type: string | null;
  reporting_year: number | null;
  department: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  linked_blocks: Array<{
    link: { id: string };
    block_code: string | null;
    block_title: string | null;
    version_id: string;
  }>;
};

export function EvidenceLibraryView({
  rows,
  linkableVersionId,
  canDelete = false,
}: {
  rows: EvidenceRow[];
  linkableVersionId?: string;
  canDelete?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "요청 실패");
      }
    });
  }

  return (
    <div className="rounded-lg border bg-white">
      {error ? (
        <p className="border-b px-4 py-2 text-sm text-destructive">{error}</p>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Filename</TableHead>
            <TableHead>Document Type</TableHead>
            <TableHead>Year</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Uploaded By</TableHead>
            <TableHead>Uploaded At</TableHead>
            <TableHead>Linked Blocks</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground">
                No evidence files yet. Upload from Annual Update.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.filename}</TableCell>
                <TableCell>{row.document_type ?? "—"}</TableCell>
                <TableCell>{row.reporting_year ?? "—"}</TableCell>
                <TableCell>{row.department ?? "—"}</TableCell>
                <TableCell>{row.uploaded_by_name ?? "—"}</TableCell>
                <TableCell>{new Date(row.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  {row.linked_blocks.length === 0
                    ? "—"
                    : row.linked_blocks
                        .map((l) => l.block_code ?? l.block_title)
                        .join(", ")}
                </TableCell>
                <TableCell className="space-x-1">
                  {row.linked_blocks[0] ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          actionUnlinkEvidence(row.linked_blocks[0].link.id),
                        )
                      }
                    >
                      Unlink
                    </Button>
                  ) : null}
                  {linkableVersionId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          actionLinkEvidence({
                            evidence_id: row.id,
                            content_version_id: linkableVersionId,
                          }),
                        )
                      }
                    >
                      Link
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => run(() => actionDeleteEvidence(row.id))}
                    >
                      Delete
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
