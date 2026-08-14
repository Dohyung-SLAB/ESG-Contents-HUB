"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  FileOutput,
  FileSearch,
  FileUp,
  FolderOpen,
  LayoutDashboard,
  RefreshCw,
  Settings,
} from "lucide-react";

import { canAccessNav, type NavItemKey } from "@/lib/services/permissions";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/enums";

const navItems: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  key: NavItemKey;
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
  { href: "/library", label: "Content Library", icon: FolderOpen, key: "library" },
  { href: "/update", label: "Annual Update", icon: RefreshCw, key: "update" },
  { href: "/review", label: "Review", icon: ClipboardCheck, key: "review" },
  { href: "/evidence", label: "Evidence", icon: FileSearch, key: "evidence" },
  { href: "/extraction", label: "Extraction", icon: FileUp, key: "extraction" },
  {
    href: "/report-draft",
    label: "Report Draft",
    icon: FileOutput,
    key: "report-draft",
  },
  { href: "/settings", label: "Settings", icon: Settings, key: "settings" },
];

export function AppSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const visible = navItems.filter((item) => canAccessNav(role, item.key));

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b border-sidebar-border px-5">
        <Link
          href="/dashboard"
          className="text-[0.95rem] font-semibold tracking-tight text-white"
        >
          ESG Content Hub
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {visible.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[0.9rem] transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-white shadow-[inset_3px_0_0_0_var(--brand-navy)]"
                  : "text-slate-400 hover:bg-sidebar-accent hover:text-white",
              )}
            >
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-[var(--brand-navy)]" : "text-slate-500",
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
