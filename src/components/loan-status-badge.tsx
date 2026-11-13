import type { LoanStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { LOAN_STATUS_LABEL } from "@/lib/labels";

const VARIANT: Record<LoanStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  APPROVED: "default",
  BORROWED: "default",
  RETURNED: "secondary",
  REJECTED: "destructive",
  CANCELLED: "secondary",
};

export function LoanStatusBadge({ status, overdue }: { status: LoanStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={VARIANT[status]}>{LOAN_STATUS_LABEL[status]}</Badge>
      {overdue && <Badge variant="destructive">เกินกำหนด</Badge>}
    </span>
  );
}
