import { redirect } from "next/navigation";
import Link from "next/link";

import {
  ExtractionCreateForm,
} from "@/components/extraction/extraction-review-view";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getSessionUser } from "@/lib/data/session";
import { listExtractionJobs } from "@/lib/services/extraction";
import { canManageExtraction } from "@/lib/services/permissions";
import { cn } from "@/lib/utils";

export default async function ExtractionIndexPage() {
  const user = await getSessionUser();
  if (!canManageExtraction(user.role)) {
    redirect("/dashboard");
  }

  const jobs = await listExtractionJobs();
  return (
    <div className="space-y-4">
      <PageHeader
        title="PDF Extraction"
        description="보고서를 업로드하고 Content Block 후보를 추출합니다."
      />
      <ExtractionCreateForm />
      <div className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold">Jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center justify-between gap-2">
                <span>
                  {job.original_filename} · {job.status}
                </span>
                <Link
                  href={`/extraction/${job.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
