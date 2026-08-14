import { PageHeader } from "@/components/layout/page-header";
import { EvidenceLibraryView } from "@/components/evidence/evidence-library-view";
import { getSessionUser } from "@/lib/data/session";
import { listEvidences } from "@/lib/services/evidence";
import { versionId } from "@/lib/seed/samlip-pilot";

export default async function EvidencePage() {
  const rows = await listEvidences();
  const user = await getSessionUser();
  return (
    <div>
      <PageHeader
        title="Evidence"
        description="증빙 파일을 조회하고 콘텐츠와 연결합니다."
      />
      <EvidenceLibraryView
        rows={rows}
        linkableVersionId={versionId(6, 2027)}
        canDelete={user.role === "ADMIN"}
      />
    </div>
  );
}
