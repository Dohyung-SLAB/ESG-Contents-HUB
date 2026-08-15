import { PageHeader } from "@/components/layout/page-header";
import { AnnualUpdateView } from "@/components/update/annual-update-view";
import { getSessionUser } from "@/lib/data/session";
import { getPilotStore } from "@/lib/data/pilot-store";
import { listSuggestions } from "@/lib/services/ai";
import { getBlockDetail, resolveBlockId } from "@/lib/services/library";
import { canEditContentBlock } from "@/lib/services/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ blockId: string }> };

async function listPreviousEvidences(previousVersionId: string) {
  if (!isSupabaseConfigured()) {
    const store = getPilotStore();
    return store.content_evidences
      .filter((ce) => ce.content_version_id === previousVersionId)
      .map((link) => {
        const evidence = store.evidences.find((e) => e.id === link.evidence_id);
        return {
          filename: evidence?.filename ?? "unknown",
          relationship_type: link.relationship_type,
        };
      });
  }

  const admin = createSupabaseAdminClient();
  const { data: links } = await admin
    .from("content_evidences")
    .select("*")
    .eq("content_version_id", previousVersionId);
  if (!links?.length) return [];
  const { data: evidences } = await admin
    .from("evidences")
    .select("id,filename")
    .in(
      "id",
      links.map((l) => l.evidence_id),
    );
  const map = new Map((evidences ?? []).map((e) => [e.id, e.filename]));
  return links.map((link) => ({
    filename: map.get(link.evidence_id) ?? "unknown",
    relationship_type: link.relationship_type,
  }));
}

export default async function UpdateBlockPage({ params }: Props) {
  const { blockId } = await params;
  const id = await resolveBlockId(blockId);
  if (!id) notFound();
  const detail = await getBlockDetail(id);
  if (!detail) notFound();
  const suggestions = await listSuggestions(id);
  const user = await getSessionUser();
  const canEdit = canEditContentBlock(user, detail.block);

  const previousEvidences = detail.previous
    ? await listPreviousEvidences(detail.previous.id)
    : [];

  return (
    <div>
      <PageHeader
        title={`Annual Update — ${detail.block.code}`}
        description="수정 메모를 적고, 필요하면 근거를 첨부한 뒤 보고서를 생성하세요."
      />
      <AnnualUpdateView
        detail={detail}
        suggestions={suggestions}
        role={user.role}
        canEdit={canEdit}
        userDepartment={user.department}
        previousEvidences={previousEvidences}
      />
    </div>
  );
}
