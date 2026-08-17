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

function sectionAnchor(title: string) {
  return `section-${encodeURIComponent(title).replace(/%/g, "")}`;
}

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
  const sections =
    model.sections.length > 0
      ? model.sections
      : [
          {
            title: "전체",
            blocks: model.blocks,
          },
        ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Draft"
        description="Extraction에서 지정한 목차(섹션)별로 보고서 초안을 정리해 미리보고 DOCX로 내려받습니다."
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

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Sticky TOC by section */}
        <aside className="h-fit rounded-lg border bg-white p-4 lg:sticky lg:top-20">
          <h2 className="mb-3 text-sm font-semibold text-[var(--brand-navy)]">
            목차 (섹션별)
          </h2>
          {sections.length === 0 || model.blocks.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              표시할 콘텐츠가 없습니다.
            </p>
          ) : (
            <nav className="space-y-3 text-sm">
              {sections.map((section, sIdx) => (
                <div key={section.title}>
                  <a
                    href={`#${sectionAnchor(section.title)}`}
                    className="font-medium text-[var(--brand-navy)] hover:underline"
                  >
                    {sIdx + 1}. {section.title}
                  </a>
                  <ul className="mt-1 space-y-0.5 border-l pl-3 text-xs text-muted-foreground">
                    {section.blocks.map((b, bIdx) => (
                      <li key={b.block.id}>
                        <a
                          href={`#block-${b.block.id}`}
                          className="hover:text-foreground hover:underline"
                        >
                          {sIdx + 1}.{bIdx + 1} {b.block.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          )}
        </aside>

        <section className="rounded-lg border bg-white p-6">
          <h1 className="text-2xl font-semibold text-[var(--brand-navy)]">
            {model.companyName} {model.reportingYear} 지속가능경영보고서 초안
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {model.projectName} · 목차 {sections.length}개 · 블록{" "}
            {model.blocks.length}개
          </p>

          {model.blocks.length === 0 ? (
            <p className="mt-8 text-sm text-muted-foreground">
              표시할 콘텐츠 블록이 없습니다. Extraction에서 목차 구간을 추출·승인한
              뒤 Annual Update를 진행하세요.
            </p>
          ) : (
            <div className="mt-10 space-y-12">
              {sections.map((section, sIdx) => (
                <div
                  key={section.title}
                  id={sectionAnchor(section.title)}
                  className="scroll-mt-24"
                >
                  <div className="mb-6 border-b pb-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      목차 섹션
                    </p>
                    <h2 className="text-xl font-semibold text-[var(--brand-navy)]">
                      {sIdx + 1}. {section.title}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      콘텐츠 블록 {section.blocks.length}개
                    </p>
                  </div>

                  <div className="space-y-10">
                    {section.blocks.map((item, bIdx) => (
                      <article
                        key={item.block.id}
                        id={`block-${item.block.id}`}
                        className="scroll-mt-24 rounded-md border border-slate-100 bg-slate-50/40 p-4"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold">
                            {sIdx + 1}.{bIdx + 1} {item.block.title}
                          </h3>
                          <StatusBadge status={item.version.status} />
                        </div>
                        <p className="mb-3 text-xs text-muted-foreground">
                          {item.block.code} · {item.block.content_type} ·{" "}
                          {item.version.reporting_year}
                          {item.issue?.name ? ` · ${item.issue.name}` : ""}
                        </p>
                        <NarrativePreview
                          narrative={
                            item.version.narrative?.trim() || "(서술 없음)"
                          }
                          className="space-y-3 text-sm leading-relaxed"
                        />
                        {item.key_facts.length > 0 ? (
                          <ul className="mt-4 space-y-1 rounded-md bg-white p-3 text-sm">
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
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
