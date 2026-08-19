import { Badge } from "@/components/ui/badge";
import type { ChangeType, ContentStatus } from "@/types/enums";
import { cn } from "@/lib/utils";

const statusClass: Record<ContentStatus, string> = {
  NOT_STARTED: "bg-[#e8ebf1] text-[#5a6570]",
  IN_PROGRESS: "bg-[#dfe6f0] text-[#32466b]",
  SUBMITTED: "bg-[#f3e0e0] text-[#970404]",
  UNDER_REVIEW: "bg-[#e8e0ef] text-[#533c72]",
  REVISION_REQUESTED: "bg-[#f5e0e0] text-[#970404]",
  APPROVED: "bg-[#d9e4ef] text-[#32466b]",
  ARCHIVED: "bg-[#e8ebf1] text-[#5a6570]",
};

const changeClass: Record<ChangeType, string> = {
  PENDING: "bg-[#e8ebf1] text-[#5a6570]",
  NO_CHANGE: "bg-[#e8ebf1] text-[#5a6570]",
  MODIFIED: "bg-[#e8e0ef] text-[#533c72]",
  NEW: "bg-[#dfe6f0] text-[#32466b]",
  DELETED: "bg-[#f5e0e0] text-[#970404]",
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
