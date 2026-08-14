import { Badge } from "@/components/ui/badge";
import type { ChangeType, ContentStatus } from "@/types/enums";
import { cn } from "@/lib/utils";

const statusClass: Record<ContentStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-sky-100 text-sky-800",
  SUBMITTED: "bg-amber-100 text-amber-800",
  UNDER_REVIEW: "bg-indigo-100 text-indigo-800",
  REVISION_REQUESTED: "bg-orange-100 text-orange-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  ARCHIVED: "bg-slate-200 text-slate-600",
};

const changeClass: Record<ChangeType, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  NO_CHANGE: "bg-slate-100 text-slate-600",
  MODIFIED: "bg-blue-100 text-blue-800",
  NEW: "bg-violet-100 text-violet-800",
  DELETED: "bg-rose-100 text-rose-800",
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", statusClass[status])}>
      {status}
    </Badge>
  );
}

export function ChangeTypeBadge({ changeType }: { changeType: ChangeType }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", changeClass[changeType])}>
      {changeType}
    </Badge>
  );
}
