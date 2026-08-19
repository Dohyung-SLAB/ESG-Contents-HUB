import { Badge } from "@/components/ui/badge";
import type { ChangeType, ContentStatus } from "@/types/enums";
import { cn } from "@/lib/utils";

const statusClass: Record<ContentStatus, string> = {
  NOT_STARTED: "bg-[#ebe3df] text-[#88726d]",
  IN_PROGRESS: "bg-[#e8f0dc] text-[#005700]",
  SUBMITTED: "bg-[#f0e6e0] text-[#88726d]",
  UNDER_REVIEW: "bg-[#ebe3df] text-[#5c4a46]",
  REVISION_REQUESTED: "bg-[#f5e0e0] text-[#970404]",
  APPROVED: "bg-[#e2efd4] text-[#005700]",
  ARCHIVED: "bg-[#ebe3df] text-[#88726d]",
};

const changeClass: Record<ChangeType, string> = {
  PENDING: "bg-[#ebe3df] text-[#88726d]",
  NO_CHANGE: "bg-[#ebe3df] text-[#88726d]",
  MODIFIED: "bg-[#efe6e2] text-[#5c4a46]",
  NEW: "bg-[#e8f0dc] text-[#418a04]",
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
