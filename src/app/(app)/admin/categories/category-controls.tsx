"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "./actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

function Err({ state }: { state: ActionState }) {
  return state && !state.ok ? <p className="text-xs text-destructive">{state.error}</p> : null;
}

export function AddCategoryForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-1">
      <div className="flex gap-2">
        <Input name="name" required placeholder="ชื่อหมวดหมู่ใหม่" aria-label="ชื่อหมวดหมู่ใหม่" />
        <Button type="submit" disabled={pending}>
          เพิ่ม
        </Button>
      </div>
      <Err state={state} />
    </form>
  );
}

export function RenameForm({ action, id, name }: { action: Action; id: string; name: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-2">
        <Input name="name" defaultValue={name} required aria-label="ชื่อหมวดหมู่" className="h-8" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          บันทึก
        </Button>
      </div>
      <Err state={state} />
    </form>
  );
}

export function DeleteForm({ action, id }: { action: Action; id: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="destructive" disabled={pending}>
        ลบ
      </Button>
      <Err state={state} />
    </form>
  );
}
