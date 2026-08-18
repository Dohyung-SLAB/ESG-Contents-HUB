import { PageHeader } from "@/components/layout/page-header";
import { SettingsView } from "@/components/settings/settings-view";
import { TeamAssignmentPanel } from "@/components/settings/team-assignment-panel";
import { getSessionUser, hasAuthSession } from "@/lib/data/session";
import { listAuditLogs } from "@/lib/services/audit";
import { listProjectInvites } from "@/lib/services/invites";
import type { ProjectInvite } from "@/lib/services/invites";
import {
  listProjectMembers,
  type MemberWithProfile,
} from "@/lib/services/members";
import { canCreateProject } from "@/lib/services/permissions";
import {
  listCompanies,
  listProjects,
  listProjectsForUser,
} from "@/lib/services/projects";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function SettingsPage() {
  const user = await getSessionUser();
  const isAdmin = user.role === "ADMIN";

  const [logs, companies, allProjects, myProjects] = await Promise.all([
    isAdmin ? listAuditLogs(100) : Promise.resolve([]),
    isAdmin ? listCompanies() : Promise.resolve([]),
    isAdmin ? listProjects() : Promise.resolve([]),
    listProjectsForUser(),
  ]);

  const membersByProject: Record<string, MemberWithProfile[]> = {};
  const invitesByProject: Record<string, ProjectInvite[]> = {};

  const projectListForTeam =
    myProjects.length > 0
      ? myProjects
      : allProjects.filter((p) =>
          companies.some((c) => c.id === p.company_id),
        );

  if (isAdmin) {
    await Promise.all(
      projectListForTeam.map(async (p) => {
        if (!p?.id) return;
        membersByProject[p.id] = await listProjectMembers(p.id);
        invitesByProject[p.id] = await listProjectInvites(p.id);
      }),
    );
  }

  const allowDemoSwitcher =
    process.env.ALLOW_DEMO_ROLE_COOKIE === "true" &&
    !(await hasAuthSession());

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description={
          isAdmin
            ? "고객사·프로젝트 관리, 담당자 초대, 감사 로그"
            : "계정 정보"
        }
      />
      <p className="text-xs text-muted-foreground">
        Data source:{" "}
        {isSupabaseConfigured() ? "Supabase (live)" : "In-memory pilot store"}
      </p>

      {isAdmin ? (
        <TeamAssignmentPanel
          projects={projectListForTeam}
          membersByProject={membersByProject}
          invitesByProject={invitesByProject}
        />
      ) : null}

      <SettingsView
        currentUser={user}
        auditLogs={logs}
        companies={companies}
        projects={allProjects}
        canCreateProject={canCreateProject(user.role)}
        showDemoRoleSwitcher={allowDemoSwitcher}
        showAuditLogs={isAdmin}
      />
    </div>
  );
}
