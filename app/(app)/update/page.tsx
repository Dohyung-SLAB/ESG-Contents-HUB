import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  NewContentRequestForm,
  PendingNewContentQueue,
} from "@/components/update/new-content-request";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSessionUser } from "@/lib/data/session";
import { listLibraryBlocks } from "@/lib/services/library";
import { getNewContentMeta } from "@/lib/services/new-content";
import {
  canApproveNewContentRequest,
  canCreateNewContentRequest,
  canViewContentBlock,
} from "@/lib/services/permissions";
import { cn } from "@/lib/utils";

export default async function UpdateIndexPage() {
  const user = await getSessionUser();
  const rows = (await listLibraryBlocks({})).filter((r) =>
    canViewContentBlock(user, r),
  );
  const knownSections = Array.from(
    new Set(rows.map((r) => r.section).filter(Boolean) as string[]),
  );
  const canCreate = canCreateNewContentRequest(user.role);
  const canApprove = canApproveNewContentRequest(user.role);

  return (
    <div className="space-y-3">
      <PageHeader
        title="Annual Update"
        description="전년 컨텐츠를 갱신하거나, 신규 컨텐츠를 요청·작성하세요."
      />

      {canCreate ? (
        <NewContentRequestForm
          role={user.role}
          userDepartment={user.department}
          knownSections={knownSections}
        />
      ) : null}

      <PendingNewContentQueue rows={rows} canApprove={canApprove} />

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>구분</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const meta = getNewContentMeta(row);
              const label =
                meta?.request_status === "PENDING_APPROVAL"
                  ? "신규 요청"
                  : meta?.request_status === "APPROVED"
                    ? "신규"
                    : row.change_type === "NEW"
                      ? "신규"
                      : "갱신";
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.code}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </TableCell>
                  <TableCell>
                    {meta?.request_status === "PENDING_APPROVAL" ? (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900">
                        승인 대기
                      </span>
                    ) : (
                      <StatusBadge status={row.status} />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/update/${row.code}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
