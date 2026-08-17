import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { ReviewView } from "@/components/review/review-view";
import { getSessionUser } from "@/lib/data/session";
import { listSuggestions } from "@/lib/services/ai";
import { resolveBlockId } from "@/lib/services/library";
import { getReviewDetail, listReviewQueue } from "@/lib/services/review";
import type { ContentStatus } from "@/types/enums";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const user = await getSessionUser();
  const queue = await listReviewQueue({
    issue: get("issue"),
    owner: get("owner"),
    content_type: get("content_type"),
    status: (get("status") as ContentStatus | undefined) ?? "",
    change_type: get("change_type"),
  });

  const code = get("blockId");
  const resolved = code ? await resolveBlockId(code) : null;
  const detail = resolved ? await getReviewDetail(resolved) : null;
  const evidenceChecks =
    resolved != null
      ? (await listSuggestions(resolved)).filter(
          (s) =>
            s.suggestion_type === "EVIDENCE_CHECK" && s.status !== "SUPERSEDED",
        )
      : [];

  return (
    <div>
      <PageHeader
        title="Review"
        description="제출된 콘텐츠가 모두 여기에 모입니다. 검토 후 승인·반려하세요."
      />
      <Suspense fallback={<p>Loading…</p>}>
        <ReviewView
          queue={queue}
          detail={detail}
          evidenceChecks={evidenceChecks}
          role={user.role}
          initialFilters={{
            issue: get("issue") ?? "",
            owner: get("owner") ?? "",
            content_type: get("content_type") ?? "",
            status: get("status") ?? "",
            change_type: get("change_type") ?? "",
          }}
        />
      </Suspense>
    </div>
  );
}
