"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  actionCreateCompanyAndProject,
  actionCreateProjectForCompany,
  actionDeleteCompany,
  actionDeleteProject,
  actionSetRole,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_GUIDE } from "@/lib/services/permissions";
import type { AuditLog, Company, Profile, Project } from "@/types/database";
import type { UserRole } from "@/types/enums";

const ROLES: UserRole[] = ["ADMIN", "CONTRIBUTOR", "REVIEWER"];

export function SettingsView({
  currentUser,
  auditLogs,
  companies,
  projects,
  canCreateProject,
  showDemoRoleSwitcher = false,
  showAuditLogs = false,
}: {
  currentUser: Profile;
  auditLogs: AuditLog[];
  companies: Company[];
  projects: Project[];
  canCreateProject: boolean;
  showDemoRoleSwitcher?: boolean;
  showAuditLogs?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [reportingYear, setReportingYear] = useState(2027);
  const [existingCompanyId, setExistingCompanyId] = useState(
    companies[0]?.id ?? "",
  );
  const [existingProjectName, setExistingProjectName] = useState("");
  const [existingYear, setExistingYear] = useState(2028);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold">내 계정</h2>
        <p className="text-sm">
          {currentUser.full_name} · {currentUser.email}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {ROLE_GUIDE[currentUser.role].labelKo}
          {currentUser.department
            ? ` · 부서 ${currentUser.department}`
            : null}
        </p>
      </section>

      {canCreateProject ? (
        <section className="rounded-lg border bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold">역할 모델</h2>
          <div className="space-y-3">
            {ROLES.map((role) => {
              const guide = ROLE_GUIDE[role];
              return (
                <div
                  key={role}
                  className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <p className="text-sm font-medium">
                    {guide.labelKo}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      ({role})
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {guide.summary}
                  </p>
                  <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                    {guide.can.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {showDemoRoleSwitcher ? (
      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold">Demo Role Switcher</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Current: {currentUser.full_name} ({ROLE_GUIDE[currentUser.role].labelKo}
          )
          {currentUser.department
            ? ` · 부서 ${currentUser.department}`
            : null}
        </p>
        <div className="flex flex-wrap gap-2">
          {ROLES.map((role) => (
            <Button
              key={role}
              size="sm"
              variant={currentUser.role === role ? "default" : "outline"}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await actionSetRole(role);
                })
              }
            >
              {ROLE_GUIDE[role].labelKo}
            </Button>
          ))}
        </div>
      </section>
      ) : null}

      {canCreateProject ? (
        <section className="rounded-lg border bg-white p-3">
          <h2 className="mb-1 text-sm font-semibold">
            고객사 · 프로젝트 생성 (관리자/컨설턴트)
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            컨설턴트 계정은 담당 고객사와 보고 연도 프로젝트를 직접 만들 수 있습니다.
          </p>

          <div className="mb-3 space-y-3 rounded-md border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              신규 고객사 + 프로젝트
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="company_name">고객사명</Label>
                <Input
                  id="company_name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="예: SPC삼립"
                />
              </div>
              <div>
                <Label htmlFor="project_name">프로젝트명</Label>
                <Input
                  id="project_name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="예: 2027 지속가능경영보고서"
                />
              </div>
              <div>
                <Label htmlFor="reporting_year">보고 연도</Label>
                <Input
                  id="reporting_year"
                  type="number"
                  value={reportingYear}
                  onChange={(e) => setReportingYear(Number(e.target.value))}
                />
              </div>
            </div>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => {
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  try {
                    const result = await actionCreateCompanyAndProject({
                      company_name: companyName,
                      project_name: projectName,
                      reporting_year: reportingYear,
                    });
                    setMessage(
                      `생성됨: ${result.company.name} / ${result.project.name} (${result.project.reporting_year})`,
                    );
                    setCompanyName("");
                    setProjectName("");
                    router.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "생성 실패");
                  }
                });
              }}
            >
              고객사+프로젝트 생성
            </Button>
          </div>

          <div className="space-y-3 rounded-md border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              기존 고객사에 프로젝트 추가
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="existing_company">고객사</Label>
                <select
                  id="existing_company"
                  className="flex h-9 w-full rounded-md border bg-white px-3 text-sm"
                  value={existingCompanyId}
                  onChange={(e) => setExistingCompanyId(e.target.value)}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="existing_project_name">프로젝트명</Label>
                <Input
                  id="existing_project_name"
                  value={existingProjectName}
                  onChange={(e) => setExistingProjectName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="existing_year">보고 연도</Label>
                <Input
                  id="existing_year"
                  type="number"
                  value={existingYear}
                  onChange={(e) => setExistingYear(Number(e.target.value))}
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !existingCompanyId}
              onClick={() => {
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  try {
                    const result = await actionCreateProjectForCompany({
                      company_id: existingCompanyId,
                      project_name: existingProjectName,
                      reporting_year: existingYear,
                    });
                    setMessage(
                      `프로젝트 추가됨: ${result.project.name} (${result.project.reporting_year})`,
                    );
                    setExistingProjectName("");
                    router.refresh();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "생성 실패");
                  }
                });
              }}
            >
              프로젝트 추가
            </Button>
          </div>

          {message ? (
            <p className="mt-3 text-sm text-emerald-700">{message}</p>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          ) : null}
        </section>
      ) : null}

      {canCreateProject ? (
        <section className="rounded-lg border bg-white p-3">
          <h2 className="mb-1 text-sm font-semibold">
            고객사 · 프로젝트 삭제
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            프로젝트(보고서) 삭제 시 해당 연도 콘텐츠·추출 작업이 함께 삭제됩니다.
            고객사 삭제 시 하위 프로젝트·Evidence까지 모두 삭제됩니다.
          </p>

          <div className="mb-3">
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              프로젝트 (보고서)
            </h3>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">프로젝트가 없습니다.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {projects.map((p) => {
                  const company = companies.find((c) => c.id === p.company_id);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span>
                        {company?.name ?? "—"} · {p.name} ({p.reporting_year})
                      </span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => {
                          const label = `${company?.name ?? "고객사"} · ${p.name} (${p.reporting_year})`;
                          if (
                            !window.confirm(
                              `"${label}" 프로젝트를 삭제할까요?\n관련 콘텐츠 블록·추출 결과도 함께 삭제됩니다.`,
                            )
                          ) {
                            return;
                          }
                          setError(null);
                          setMessage(null);
                          startTransition(async () => {
                            try {
                              await actionDeleteProject(p.id);
                              setMessage(`프로젝트 삭제됨: ${label}`);
                              router.refresh();
                            } catch (e) {
                              setError(
                                e instanceof Error ? e.message : "삭제 실패",
                              );
                            }
                          });
                        }}
                      >
                        삭제
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              고객사
            </h3>
            {companies.length === 0 ? (
              <p className="text-sm text-muted-foreground">고객사가 없습니다.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {companies.map((c) => {
                  const count = projects.filter(
                    (p) => p.company_id === c.id,
                  ).length;
                  return (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span>
                        {c.name}{" "}
                        <span className="text-muted-foreground">
                          · 프로젝트 {count}개
                        </span>
                      </span>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `"${c.name}" 고객사와 하위 프로젝트 ${count}개를 모두 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`,
                            )
                          ) {
                            return;
                          }
                          setError(null);
                          setMessage(null);
                          startTransition(async () => {
                            try {
                              await actionDeleteCompany(c.id);
                              setMessage(`고객사 삭제됨: ${c.name}`);
                              if (existingCompanyId === c.id) {
                                setExistingCompanyId("");
                              }
                              router.refresh();
                            } catch (e) {
                              setError(
                                e instanceof Error ? e.message : "삭제 실패",
                              );
                            }
                          });
                        }}
                      >
                        고객사 삭제
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {message ? (
            <p className="mt-3 text-sm text-emerald-700">{message}</p>
          ) : null}
          {error ? (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          ) : null}
        </section>
      ) : null}

      {showAuditLogs ? (
      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold">Audit Log</h2>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit events yet.</p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
            {auditLogs.map((log) => (
              <li key={log.id} className="rounded bg-slate-50 px-3 py-2">
                <p className="font-medium">
                  {log.action} · {log.entity_type}
                </p>
                <p className="text-xs text-muted-foreground">
                  {log.entity_id} · {new Date(log.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      ) : null}
    </div>
  );
}
