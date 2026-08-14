import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listLibraryBlocks } from "@/lib/services/library";
import { canViewContentBlock } from "@/lib/services/permissions";
import { getSessionUser } from "@/lib/data/session";
import { cn } from "@/lib/utils";

export default async function UpdateIndexPage() {
  const user = await getSessionUser();
  const rows = (await listLibraryBlocks({})).filter((r) =>
    canViewContentBlock(user, r),
  );

  return (
    <div>
      <PageHeader
        title="Annual Update"
        description="업데이트 대상 콘텐츠 블록을 선택하세요."
      />
      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.code}</TableCell>
                <TableCell>{row.title}</TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/update/${row.code}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Open
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
