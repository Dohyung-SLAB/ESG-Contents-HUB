import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getSessionUser, hasAuthSession } from "@/lib/data/session";
import { isAwaitingAssignment } from "@/lib/services/members";
import {
  getActiveWorkspace,
  listProjectsForUser,
} from "@/lib/services/projects";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Company, Project } from "@/types/database";

const EMPTY_COMPANY: Company = {
  id: "",
  name: "(고객사 없음)",
  brand_primary: null,
  created_at: "",
  updated_at: "",
};

const EMPTY_PROJECT: Project = {
  id: "",
  company_id: "",
  name: "프로젝트를 생성하세요",
  reporting_year: new Date().getFullYear(),
  base_year: null,
  status: "ACTIVE",
  created_at: "",
  updated_at: "",
};

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (isSupabaseConfigured() && !(await hasAuthSession())) {
    if (process.env.ALLOW_DEMO_ROLE_COOKIE !== "true") {
      redirect("/login");
    }
  }

  const user = await getSessionUser();
  if (await isAwaitingAssignment(user)) {
    redirect("/waiting");
  }

  const projects = await listProjectsForUser();
  let company = EMPTY_COMPANY;
  let project = EMPTY_PROJECT;
  if (projects.length > 0) {
    try {
      const workspace = await getActiveWorkspace();
      company = workspace.company;
      project = workspace.project;
    } catch {
      // No accessible projects — Settings can create one (ADMIN).
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          company={company}
          project={project}
          projects={projects}
          user={user}
        />
        <main className="flex-1 overflow-y-auto bg-[var(--background)] p-3 sm:p-4">
          <div className="mx-auto w-full max-w-none">{children}</div>
        </main>
      </div>
    </div>
  );
}
