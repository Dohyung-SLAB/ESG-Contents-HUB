import { redirect } from "next/navigation";
import Link from "next/link";

import { NarrativePreview } from "@/components/extraction/narrative-preview";
import { PageHeader } from "@/components/layout/page-header";
import { ReportDraftDownloadButton } from "@/components/report/report-draft-download-button";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { getSessionUser } from "@/lib/data/session";
import { canAccessNav } from "@/lib/services/permissions";
import { buildReportDraftModel } from "@/lib/services/report-draft";
import { cn } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ReportDraftPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getSessionUser();
  if (!canAccessNav(user.role, "report-draft")) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const approvedOnly =
    (Array.isArray(params.approvedOnly)
      ? params.approvedOnly[0]
      : params.approvedOnly) === "1";

  const model = await buildReportDraftModel({ approvedOnly });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Draft"
        description="수정·승인된 콘텐츠를 모아 보고서 초안을 미리보고 DOCX로 내려받습니다."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/report-draft"
          className={cn(
            buttonVariants({ variant: approvedOnly ? "outline" : "default" }),
            "text-sm",
          )}
        >
          전체 버전 포함
        </Link>
        <Link
          href="/report-draft?approvedOnly=1"
          className={cn(
            buttonVariants({ variant: approvedOnly ? "default" : "outline" }),
            "text-sm",
          )}
        >
          승인본만
        </Link>
        <ReportDraftDownloadButton approvedOnly={approvedOnly} />
      </div>

      <section className="rounded-lg border bg-white p-6">
        <h1 className="text-2xl font-semibold text-[var(--brand-navy)]">
          {model.companyName} {model.reportingYear} 지속가능경영보고서 초안
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{model.projectName}</p>

        <h2 className="mt-8 text-lg font-semibold">목차</h2>
        {model.blocks.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            표시할 콘텐츠 블록이 없습니다. Extraction 승인 또는 Annual Update 후
            다시 확인하세요.
          </p>
        ) : (
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {model.blocks.map((b) => (
              <li key={b.block.id}>
                <a href={`#block-${b.block.id}`} className="hover:underline">
                  {b.block.title}
                </a>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-10 space-y-10">
          {model.blocks.map((item, idx) => (
            <article
              key={item.block.id}
              id={`block-${item.block.id}`}
              className="scroll-mt-24 border-t pt-6"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">
                  {idx + 1}. {item.block.title}
                </h2>
                <StatusBadge status={item.version.status} />
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {item.block.code} · {item.block.section} ·{" "}
                {item.block.content_type} · {item.version.reporting_year}
              </p>
              <NarrativePreview
                narrative={item.version.narrative?.trim() || "(서술 없음)"}
                className="space-y-3 text-sm leading-relaxed"
              />
              {item.key_facts.length > 0 ? (
                <ul className="mt-4 space-y-1 rounded-md bg-slate-50 p-3 text-sm">
                  {item.key_facts.map((f) => (
                    <li key={f.id}>
                      <span className="font-medium">{f.key}</span>:{" "}
                      {f.value_number != null
                        ? `${f.value_number}${f.unit ? ` ${f.unit}` : ""}`
                        : (f.value_text ?? "")}
                    </li>
                  ))}
                </ul>
              ) : null}
              {item.version.change_summary ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Change summary: {item.version.change_summary}
                </p>
              ) : null}
              <Link
                href={`/update/${item.block.code}`}
                className="mt-3 inline-block text-xs text-[var(--brand-navy)] underline"
              >
                Annual Update 열기
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
