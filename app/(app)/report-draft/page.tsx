import { redirect } from "next/navigation";
import Link from "next/link";

import { NarrativePreview } from "@/components/extraction/narrative-preview";
import { PageHeader } from "@/components/layout/page-header";
import { ReportDraftDownloadButton } from "@/components/report/report-draft-download-button";
import { ActivityPhotosGallery } from "@/components/update/activity-photos";
import { buttonVariants } from "@/components/ui/button";
import { getSessionUser } from "@/lib/data/session";
import { canAccessNav } from "@/lib/services/permissions";
import {
  buildReportDraftModel,
  withActivityPhotoUrls,
  type ReportDraftBlock,
} from "@/lib/services/report-draft";
import { cn } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function sectionAnchor(title: string) {
  return `section-${encodeURIComponent(title).replace(/%/g, "")}`;
}

function categoryAnchor(sectionTitle: string, categoryTitle: string) {
  return `cat-${encodeURIComponent(`${sectionTitle}__${categoryTitle}`).replace(/%/g, "")}`;
}

async function ContentArticle({
  item,
  headingLevel,
}: {
  item: ReportDraftBlock;
  headingLevel: "h3" | "h4";
}) {
  const narrative = item.version.narrative?.trim() || "";
  const headingClass =
    headingLevel === "h3"
      ? "text-[1.35rem] font-bold tracking-tight text-[var(--brand-ink)]"
      : "text-[1.15rem] font-bold tracking-tight text-[var(--brand-ink)]";
  const photos = await withActivityPhotoUrls(item.activity_photos ?? []);

  return (
    <article id={`block-${item.block.id}`} className="scroll-mt-28">
      {headingLevel === "h3" ? (
        <h3 className={headingClass}>{item.block.title}</h3>
      ) : (
        <h4 className={headingClass}>{item.block.title}</h4>
      )}

      {narrative ? (
        <NarrativePreview
          narrative={narrative}
          className="mt-3 space-y-3 text-[0.95rem] leading-[1.85] text-[#2f4858]"
        />
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">(서술 없음)</p>
      )}

      <ActivityPhotosGallery photos={photos} />
    </article>
  );
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
              categories: [{ title: "", blocks: model.blocks }],
              blocks: model.blocks,
            },
          ];

    return (
      <div className="space-y-4">
        <PageHeader
          title="Report Draft"
          description="Extraction 목차·카테고리 계층으로 보고서처럼 미리보고 DOCX로 내려받습니다."
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

        <div className="grid gap-3 lg:grid-cols-[minmax(280px,340px)_minmax(0,48rem)] lg:justify-start">
          <aside className="h-fit rounded-lg border bg-white p-3 lg:sticky lg:top-16">
            <h2 className="mb-2 text-sm font-semibold text-[var(--brand-navy)]">
              목차
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
                    <ul className="mt-1 space-y-1 border-l border-slate-200 pl-3 text-xs text-muted-foreground">
                      {section.categories.map((cat) =>
                        cat.title ? (
                          <li key={`${section.title}-${cat.title}`}>
                            <a
                              href={`#${categoryAnchor(section.title, cat.title)}`}
                              className="font-medium text-slate-600 hover:text-foreground hover:underline"
                            >
                              {cat.title}
                            </a>
                            <ul className="mt-0.5 space-y-0.5 pl-2">
                              {cat.blocks.map((b) => (
                                <li key={b.block.id}>
                                  <a
                                    href={`#block-${b.block.id}`}
                                    className="hover:text-foreground hover:underline"
                                  >
                                    {b.block.title}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </li>
                        ) : (
                          cat.blocks.map((b) => (
                            <li key={b.block.id}>
                              <a
                                href={`#block-${b.block.id}`}
                                className="hover:text-foreground hover:underline"
                              >
                                {b.block.title}
                              </a>
                            </li>
                          ))
                        ),
                      )}
                    </ul>
                  </div>
                ))}
              </nav>
            )}
          </aside>

          {/* Document-style preview (category → nested content) */}
          <section className="rounded-lg border border-slate-200 bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
            <header className="border-b border-slate-200 pb-4">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--brand-ink)]">
                {model.companyName} {model.reportingYear} 지속가능경영보고서 초안
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {model.projectName} · 목차 {sections.length}개 · 콘텐츠{" "}
                {model.blocks.length}개
              </p>
            </header>

            {model.blocks.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                표시할 콘텐츠 블록이 없습니다. Extraction에서 목차 구간을
                추출·승인한 뒤 Annual Update를 진행하세요.
              </p>
            ) : (
              <div className="mt-8 space-y-10">
                {sections.map((section, sIdx) => (
                  <div
                    key={section.title}
                    id={sectionAnchor(section.title)}
                    className="scroll-mt-24"
                  >
                    {/* Top-level category (TOC), report chapter style */}
                    <h2 className="text-[1.5rem] font-bold tracking-tight text-[var(--brand-ink)]">
                      {sIdx + 1}. {section.title}
                    </h2>

                    <div className="mt-5 space-y-8">
                      {section.categories.map((cat) => (
                        <div
                          key={`${section.title}-${cat.title || "root"}`}
                          id={
                            cat.title
                              ? categoryAnchor(section.title, cat.title)
                              : undefined
                          }
                          className="scroll-mt-24"
                        >
                          {cat.title ? (
                            <h3 className="mb-5 text-lg font-bold text-[var(--brand-ink)]">
                              {cat.title}
                            </h3>
                          ) : null}

                          <div className="space-y-8">
                            {cat.blocks.map((item) => (
                              <ContentArticle
                                key={item.block.id}
                                item={item}
                                headingLevel={cat.title ? "h4" : "h3"}
                              />
                            ))}
                          </div>
                        </div>
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
