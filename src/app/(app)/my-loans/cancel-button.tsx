"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { cancelLoanAction } from "./actions";

export function CancelButton({ loanId }: { loanId: string }) {
  const [state, formAction, pending] = useActionState(cancelLoanAction, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm("ยืนยันการยกเลิกคำขอนี้?")) e.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="loanId" value={loanId} />
      <Button type="submit" variant="destructive" disabled={pending}>
        ยกเลิกคำขอ
      </Button>
      {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
