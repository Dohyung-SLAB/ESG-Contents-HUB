"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User } from "lucide-react";

import { actionSignOut, actionSwitchProject } from "@/lib/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_GUIDE } from "@/lib/services/permissions";
import { cn } from "@/lib/utils";
import type { Company, Profile, Project } from "@/types/database";

export function AppHeader({
  company,
  project,
  projects,
  user,
}: {
  company: Company;
  project: Project;
  projects: Array<Project & { company: Company }>;
  user: Pick<Profile, "full_name" | "email" | "role">;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-6 border-b border-border bg-white px-6">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Active Project
          </p>
          <select
            className="mt-0.5 max-w-md truncate rounded-md border border-border bg-white px-2 py-1 text-[0.9rem] font-medium text-[var(--brand-ink)]"
            disabled={pending || projects.length === 0}
            value={project.id || undefined}
            onChange={(e) => {
              const next = e.target.value;
              startTransition(async () => {
                await actionSwitchProject(next);
                router.refresh();
              });
            }}
          >
            {projects.length === 0 ? (
              <option value="">프로젝트 없음</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company.name} · {p.name} ({p.reporting_year})
                </option>
              ))
            )}
          </select>
        </div>
        <div className="hidden min-w-0 md:block">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Company
          </p>
          <p className="truncate text-sm font-medium">{company.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {ROLE_GUIDE[user.role].labelKo}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "flex h-9 items-center gap-2 px-2",
            )}
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-[var(--brand-navy)] text-xs text-white">
                {user.full_name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium md:inline">
              {user.full_name}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{user.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                startTransition(async () => {
                  await actionSignOut();
                  router.replace("/login");
                  router.refresh();
                });
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
