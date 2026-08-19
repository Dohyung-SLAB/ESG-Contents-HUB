"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  actionAssignProjectMember,
  actionRemoveProjectMember,
  actionRevokeProjectInvite,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONSULTANT_EMAIL_DOMAIN } from "@/lib/auth-constants";
import type { ProjectInvite } from "@/lib/services/invites";
import { PILOT_DEPARTMENTS, ROLE_GUIDE } from "@/lib/services/permissions";
import type { MemberWithProfile } from "@/lib/services/members";
import type { Project } from "@/types/database";

export function TeamAssignmentPanel({
  projects,
  membersByProject,
  invitesByProject,
}: {
  projects: Project[];
  membersByProject: Record<string, MemberWithProfile[]>;
  invitesByProject: Record<string, ProjectInvite[]>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"CONTRIBUTOR" | "REVIEWER">(
    "CONTRIBUTOR",
  );
  const [department, setDepartment] = useState("품질보증");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const members = useMemo(
    () => membersByProject[projectId] ?? [],
    [membersByProject, projectId],
  );
  const invites = useMemo(
    () => (invitesByProject[projectId] ?? []).filter((i) => i.status === "PENDING"),
    [invitesByProject, projectId],
  );

  if (projects.length === 0) {
    return (
      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold">고객사 담당자 초대</h2>
        <p className="text-sm text-muted-foreground">
          먼저 고객사·프로젝트를 생성한 뒤, 가입을 허용할 이메일을 초대하세요.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-white p-3">
      <h2 className="mb-1 text-sm font-semibold">고객사 담당자 초대</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        초대한 이메일만 Reviewer/Contributor로 가입할 수 있습니다. 컨설턴트는{" "}
        <span className="font-mono">@{CONSULTANT_EMAIL_DOMAIN}</span> 계정만
        가입 가능합니다.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>프로젝트</Label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.reporting_year})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>역할</Label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={memberRole}
            onChange={(e) =>
              setMemberRole(e.target.value as "CONTRIBUTOR" | "REVIEWER")
            }
          >
            <option value="CONTRIBUTOR">
              {ROLE_GUIDE.CONTRIBUTOR.labelKo}
            </option>
            <option value="REVIEWER">{ROLE_GUIDE.REVIEWER.labelKo}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>초대할 이메일</Label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@client.com"
          />
        </div>
        <div className="space-y-2">
          <Label>부서 (현업 배정 시)</Label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={
              PILOT_DEPARTMENTS.includes(
                department as (typeof PILOT_DEPARTMENTS)[number],
              )
                ? department
                : "__custom__"
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom__") {
                setDepartment("");
                return;
              }
              setDepartment(v);
            }}
            disabled={memberRole !== "CONTRIBUTOR"}
          >
            {PILOT_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
            <option value="__custom__">직접 입력…</option>
          </select>
          {!PILOT_DEPARTMENTS.includes(
            department as (typeof PILOT_DEPARTMENTS)[number],
          ) || department === "" ? (
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="부서명 직접 입력 (예: 생산기술팀)"
              disabled={memberRole !== "CONTRIBUTOR"}
            />
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Contributor 초대 시 현업 부서를 목록에서 고르거나 직접 작성할 수
            있습니다.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          disabled={
            pending ||
            !email.trim() ||
            (memberRole === "CONTRIBUTOR" && !department.trim())
          }
          onClick={() => {
            setMessage(null);
            setError(null);
            startTransition(async () => {
              const result = await actionAssignProjectMember({
                projectId,
                email,
                memberRole,
                department:
                  memberRole === "CONTRIBUTOR"
                    ? department.trim() || null
                    : "ESG",
              });
              if (!result.ok) {
                setError(result.error ?? "초대 실패");
                return;
              }
              setMessage(`${email} 초대 등록 완료 — 이제 해당 이메일로 가입할 수 있습니다.`);
              setEmail("");
              router.refresh();
            });
          }}
        >
          이메일 초대 등록
        </Button>
        {message ? (
          <p className="text-sm text-emerald-700">{message}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-medium">가입 대기 초대 (PENDING)</h3>
        {invites.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">대기 중 초대 없음</p>
        ) : (
          <ul className="mt-2 divide-y rounded-md border">
            {invites.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {inv.email}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      ({inv.member_role})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {inv.department ?? "부서 미지정"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await actionRevokeProjectInvite(inv.id, inv.email);
                      router.refresh();
                    })
                  }
                >
                  취소
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-medium">가입 완료 멤버</h3>
        {members.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">멤버 없음</p>
        ) : (
          <ul className="mt-2 divide-y rounded-md border">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {m.profile.full_name}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      ({m.member_role})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.profile.email}
                    {m.profile.department
                      ? ` · ${m.profile.department}`
                      : ""}
                  </p>
                </div>
                {m.member_role !== "ADMIN" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await actionRemoveProjectMember(
                          projectId,
                          m.profile_id,
                        );
                        router.refresh();
                      })
                    }
                  >
                    제거
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">컨설턴트</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
