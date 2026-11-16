import type { LoanStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { LOAN_STATUS_LABEL } from "@/lib/labels";

// Brand status colors (globals.css --status-*). Each badge carries a dot plus
// its label, so status never depends on color alone.
const STATUS_CLASS: Record<LoanStatus, string> = {
  PENDING: "bg-status-pending-bg text-status-pending",
  APPROVED: "bg-status-approved-bg text-status-approved",
  BORROWED: "bg-status-borrowed-bg text-status-borrowed",
  RETURNED: "bg-status-returned-bg text-status-returned",
  REJECTED: "bg-status-rejected-bg text-status-rejected",
  CANCELLED: "bg-status-cancelled-bg text-status-cancelled",
};

const DOT = "gap-1.5 before:size-1.5 before:rounded-full before:bg-current before:content-['']";

export function LoanStatusBadge({ status, overdue }: { status: LoanStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge className={`${STATUS_CLASS[status]} ${DOT}`}>{LOAN_STATUS_LABEL[status]}</Badge>
      {overdue && <Badge className={`bg-status-overdue text-white ${DOT}`}>เกินกำหนด</Badge>}
    </span>
  );
}
