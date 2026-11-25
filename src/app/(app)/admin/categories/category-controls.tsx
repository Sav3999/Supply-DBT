"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFormAction } from "@/lib/use-form-action";
import type { ActionState } from "./actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

function Err({ state }: { state: ActionState }) {
  return state && !state.ok ? <p className="text-xs text-destructive">{state.error}</p> : null;
}

export function AddCategoryForm({ action }: { action: Action }) {
  const { state, pending, form } = useFormAction(action, null, { resetOnSuccess: true });
  return (
    <form {...form} className="space-y-1">
      <div className="flex gap-2">
        <Input name="name" required placeholder="ชื่อหมวดหมู่ใหม่" aria-label="ชื่อหมวดหมู่ใหม่" />
        <Button type="submit" disabled={pending}>
          เพิ่ม
        </Button>
      </div>
      <Err state={state} />
      {state?.ok && <p className="text-xs text-status-returned">เพิ่มหมวดหมู่แล้ว</p>}
    </form>
  );
}

export function RenameForm({ action, id, name }: { action: Action; id: number; name: string }) {
  const { state, pending, form } = useFormAction(action, null);
  return (
    <form {...form} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-2">
        <Input name="name" defaultValue={name} required aria-label="ชื่อหมวดหมู่" className="h-8 min-w-36" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          บันทึก
        </Button>
      </div>
      <Err state={state} />
      {state?.ok && <p className="text-xs text-status-returned">บันทึกแล้ว</p>}
    </form>
  );
}

export function DeleteForm({ action, id, name, itemCount }: { action: Action; id: number; name: string; itemCount: number }) {
  const { state, pending, form } = useFormAction(action, null, {
    confirm: `ลบหมวดหมู่ “${name}” ใช่ไหม? ลบแล้วกู้คืนไม่ได้`,
  });
  if (itemCount > 0) {
    return <span className="text-xs text-muted-foreground">ลบไม่ได้ (มีของ {itemCount} รายการ)</span>;
  }
  return (
    <form {...form} className="inline-flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="destructive" disabled={pending} aria-label={`ลบ ${name}`}>
        ลบ
      </Button>
      <Err state={state} />
    </form>
  );
}
