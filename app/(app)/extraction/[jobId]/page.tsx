import { notFound, redirect } from "next/navigation";

import { ExtractionReviewView } from "@/components/extraction/extraction-review-view";
import { PageHeader } from "@/components/layout/page-header";
import { getSessionUser } from "@/lib/data/session";
import { getExtractionJob } from "@/lib/services/extraction";
import { canManageExtraction } from "@/lib/services/permissions";

type Props = { params: Promise<{ jobId: string }> };

export default async function ExtractionJobPage({ params }: Props) {
  const user = await getSessionUser();
  if (!canManageExtraction(user.role)) {
    redirect("/dashboard");
  }

  const { jobId } = await params;
  const data = await getExtractionJob(jobId);
  if (!data) notFound();

  return (
    <div>
      <PageHeader
        title={`Extraction — ${data.job.original_filename}`}
        description="후보를 검토하고 Content Library로 승인합니다."
      />
      <ExtractionReviewView
        job={data.job}
        candidates={data.candidates}
        summary={data.summary}
        diagnostics={data.diagnostics}
      />
    </div>
  );
}
