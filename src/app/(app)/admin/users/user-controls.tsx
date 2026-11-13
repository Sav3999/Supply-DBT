"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/labels";
import type { ActionState } from "./actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function ActionButton({
  action,
  userId,
  label,
  variant = "default",
}: {
  action: Action;
  userId: string;
  label: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {label}
      </Button>
      {state && !state.ok && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function RoleSelect({
  action,
  userId,
  role,
}: {
  action: Action;
  userId: string;
  role: keyof typeof ROLE_LABEL;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        disabled={pending}
        aria-label="บทบาท"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
      >
        {Object.entries(ROLE_LABEL).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {state && !state.ok && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
