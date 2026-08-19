import { Suspense } from "react";

import { LibraryView } from "@/components/library/library-view";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionUser } from "@/lib/data/session";
import {
  getBlockDetail,
  listLibraryBlocks,
  resolveBlockId,
} from "@/lib/services/library";
import {
  canAssignOwnerDepartment,
  canViewContentBlock,
} from "@/lib/services/permissions";
import { getActiveWorkspace } from "@/lib/services/projects";
import type { ChangeType, ContentStatus, ContentType, UpdateType } from "@/types/enums";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const [user, { company, project }] = await Promise.all([
    getSessionUser(),
    getActiveWorkspace(),
  ]);
  let rows = await listLibraryBlocks({
    q: get("q"),
    section: get("section"),
    status: (get("status") as ContentStatus | undefined) ?? "",
    content_type: (get("content_type") as ContentType | undefined) ?? "",
    update_type: (get("update_type") as UpdateType | undefined) ?? "",
    owner: get("owner") ?? "",
    change_type: (get("change_type") as ChangeType | undefined) ?? "",
  });

  rows = rows.filter((r) => canViewContentBlock(user, r));

  const blockParam = get("blockId");
  const resolved = blockParam ? await resolveBlockId(blockParam) : null;
  const selected = resolved ? await getBlockDetail(resolved) : null;
  const selectedVisible =
    selected && canViewContentBlock(user, selected.block) ? selected : null;

  return (
    <div>
      <PageHeader
        title="Content Library"
        description={`${company.name} ${project.reporting_year} · ${project.name} 콘텐츠 블록을 조회합니다.`}
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <LibraryView
          rows={rows}
          selected={selectedVisible}
          canAssignDepartment={canAssignOwnerDepartment(user.role)}
          canEditSection={user.role === "ADMIN"}
          knownSections={Array.from(
            new Set(rows.map((r) => r.section).filter(Boolean) as string[]),
          )}
        />
      </Suspense>
    </div>
  );
}
