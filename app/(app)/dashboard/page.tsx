import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/data/session";
import { getDashboardMetrics } from "@/lib/services/dashboard";
import {
  getActiveWorkspace,
  listProjectsForUser,
} from "@/lib/services/projects";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await getSessionUser();
  const projects = await listProjectsForUser();

  if (projects.length === 0) {
    return (
      <div>
        <PageHeader
          title="Dashboard"
          description="아직 배정된 프로젝트가 없습니다."
        />
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="text-base">시작하기</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {user.role === "ADMIN" ? (
              <>
                <p>
                  Settings에서 고객사·프로젝트를 만든 뒤, 담당자 이메일을
                  초대하세요.
                </p>
                <Link
                  href="/settings"
                  className={cn(buttonVariants(), "inline-flex")}
                >
                  Settings로 이동
                </Link>
              </>
            ) : (
              <p>
                담당 컨설턴트에게 이메일 초대를 요청한 뒤 다시 로그인해 주세요.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [{ company, project }, metrics] = await Promise.all([
    getActiveWorkspace(),
    getDashboardMetrics(),
  ]);

  const kpiCards = [
    { label: "Total", value: metrics.kpis.total, href: "/library" },
    {
      label: "Not Started",
      value: metrics.kpis.notStarted,
      href: "/library?status=NOT_STARTED",
    },
    {
      label: "In Progress",
      value: metrics.kpis.inProgress,
      href: "/library?status=IN_PROGRESS",
    },
    {
      label: "Submitted",
      value: metrics.kpis.submitted,
      href: "/review?status=SUBMITTED",
    },
    {
      label: "Under Review",
      value: metrics.kpis.underReview,
      href: "/review?status=UNDER_REVIEW",
    },
    {
      label: "Revision Requested",
      value: metrics.kpis.revision,
      href: "/library?status=REVISION_REQUESTED",
    },
    {
      label: "Approved",
      value: metrics.kpis.approved,
      href: "/library?status=APPROVED",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`${company.name} ${project.reporting_year} · ${project.name} 진행 현황`}
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {kpiCards.map((card) => (
          <Link key={card.label} href={card.href}>
            <Card className="transition hover:border-[var(--brand-navy)]">
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-[var(--brand-navy)]">
                  {card.value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mb-3 grid gap-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change Types</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Pending" value={metrics.changes.pending} />
            <Row label="No Change" value={metrics.changes.noChange} />
            <Row label="Modified" value={metrics.changes.modified} />
            <Row label="New" value={metrics.changes.new} />
            <Row label="Deleted" value={metrics.changes.deleted} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress Rates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row
              label="Submission"
              value={`${metrics.rates.submissionRate.toFixed(0)}%`}
            />
            <Row
              label="Review Completion"
              value={`${metrics.rates.reviewCompletionRate.toFixed(0)}%`}
            />
            <Row
              label="Approval"
              value={`${metrics.rates.approvalRate.toFixed(0)}%`}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Section Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {metrics.sectionProgress.map((s) => (
              <Row
                key={s.section}
                label={s.section}
                value={`${s.approved}/${s.total} (${s.rate.toFixed(0)}%)`}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Action Required</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 lg:grid-cols-3 text-sm">
          <ActionList
            title="미착수"
            items={metrics.actionRequired.not_started.map((b) => b.code)}
            href="/library?status=NOT_STARTED"
          />
          <ActionList
            title="제출 대기"
            items={metrics.actionRequired.awaiting_submit.map((b) => b.code)}
            href="/library?status=IN_PROGRESS"
          />
          <ActionList
            title="수정 요청"
            items={metrics.actionRequired.revision_requested.map((b) => b.code)}
            href="/library?status=REVISION_REQUESTED"
          />
          <ActionList
            title="Evidence 없음"
            items={metrics.actionRequired.no_evidence.map((b) => b.code)}
            href="/evidence"
          />
          <ActionList
            title="Reviewer 미지정"
            items={metrics.actionRequired.no_reviewer.map((b) => b.code)}
            href="/library"
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function ActionList({
  title,
  items,
  href,
}: {
  title: string;
  items: string[];
  href: string;
}) {
  return (
    <div>
      <Link href={href} className="font-medium text-[var(--brand-navy)] underline">
        {title} ({items.length})
      </Link>
      <p className="mt-1 text-muted-foreground">
        {items.length === 0 ? "없음" : items.slice(0, 8).join(", ")}
        {items.length > 8 ? "…" : ""}
      </p>
    </div>
  );
}
