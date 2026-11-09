"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { ActionState } from "./actions";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export const CONDITION_LABEL = { GOOD: "ปกติ", DAMAGED: "ชำรุด", LOST: "สูญหาย" } as const;

function ErrorText({ state }: { state: ActionState }) {
  return state && !state.ok ? <p className="text-sm text-destructive">{state.error}</p> : null;
}

function ConditionSelect({ name, label }: { name: string; label: string }) {
  return (
    <select
      name={name}
      defaultValue="GOOD"
      aria-label={label}
      className="h-9 rounded-lg border border-input bg-background px-2 text-sm"
    >
      {Object.entries(CONDITION_LABEL).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export function ActionButton({
  action,
  loanId,
  label,
  confirmText,
  variant = "default",
}: {
  action: Action;
  loanId: string;
  label: string;
  confirmText?: string;
  variant?: "default" | "outline" | "destructive";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (confirmText && !confirm(confirmText)) e.preventDefault();
      }}
      className="flex flex-col gap-1"
    >
      <input type="hidden" name="loanId" value={loanId} />
      <Button type="submit" size="lg" variant={variant} disabled={pending}>
        {label}
      </Button>
      <ErrorText state={state} />
    </form>
  );
}

export function RejectForm({ action, loanId }: { action: Action; loanId: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border p-3">
      <input type="hidden" name="loanId" value={loanId} />
      <Label htmlFor="reject-reason">เหตุผลที่ไม่อนุมัติ</Label>
      <textarea
        id="reject-reason"
        name="reason"
        required
        maxLength={500}
        rows={2}
        className="rounded-lg border border-input bg-transparent px-3 py-2 text-base md:text-sm"
      />
      <Button type="submit" variant="destructive" size="lg" disabled={pending}>
        ไม่อนุมัติ
      </Button>
      <ErrorText state={state} />
    </form>
  );
}

export type HandOverLine = {
  id: string;
  name: string;
  quantity: number;
  serialized: boolean;
  available: { id: string; assetTag: string }[];
};

export function HandOverForm({ action, loanId, lines }: { action: Action; loanId: string; lines: HandOverLine[] }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const ready = lines.every((l) => !l.serialized || (picked[l.id] ?? 0) === l.quantity);
  return (
    <form
      action={formAction}
      // count from the form itself so the counter stays right after React resets the form post-submit
      onChange={(e) => {
        const fd = new FormData(e.currentTarget);
        setPicked(Object.fromEntries(lines.map((l) => [l.id, fd.getAll(`asset:${l.id}`).length])));
      }}
      onReset={() => setPicked({})}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <input type="hidden" name="loanId" value={loanId} />
      <h2 className="font-medium">ส่งมอบของ</h2>
      {lines.map((l) => (
        <fieldset key={l.id} className="space-y-2">
          <legend className="text-sm">
            {l.name} — {l.quantity} ชิ้น
            {l.serialized && (
              <span className="text-muted-foreground">
                {" "}
                (เลือกแล้ว {picked[l.id] ?? 0}/{l.quantity})
              </span>
            )}
          </legend>
          {!l.serialized ? (
            <p className="text-sm text-muted-foreground">ไม่มีเลขครุภัณฑ์ ส่งมอบตามจำนวน</p>
          ) : l.available.length === 0 ? (
            <p className="text-sm text-destructive">ไม่มีเลขครุภัณฑ์ที่ว่าง</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {l.available.map((a) => (
                <label key={a.id} className="flex min-h-10 items-center gap-2 rounded-md border px-2 text-sm">
                  <input type="checkbox" name={`asset:${l.id}`} value={a.id} />
                  {a.assetTag}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ))}
      <Button type="submit" size="lg" disabled={pending || !ready}>
        ยืนยันส่งมอบ
      </Button>
      <ErrorText state={state} />
    </form>
  );
}

export type ReturnLine = {
  id: string;
  name: string;
  serialized: boolean;
  outstanding: number;
  assets: { id: string; assetTag: string }[]; // unreturned assets of this line
};

export function ReturnForm({ action, loanId, lines }: { action: Action; loanId: string; lines: ReturnLine[] }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-3">
      <input type="hidden" name="loanId" value={loanId} />
      <h2 className="font-medium">รับคืน</h2>
      <p className="text-sm text-muted-foreground">คืนบางส่วนได้ เลือกเฉพาะชิ้นที่ได้รับคืนวันนี้</p>
      {lines.map((l) => (
        <fieldset key={l.id} className="space-y-2">
          <legend className="text-sm">
            {l.name} <span className="text-muted-foreground">(ค้าง {l.outstanding})</span>
          </legend>
          {l.serialized ? (
            l.assets.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                <label className="flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" name="ret" value={`${l.id}:${a.id}`} />
                  {a.assetTag}
                </label>
                <ConditionSelect name={`cond:${l.id}:${a.id}`} label={`สภาพ ${a.assetTag}`} />
              </div>
            ))
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                name={`qty:${l.id}`}
                min={0}
                max={l.outstanding}
                defaultValue={0}
                aria-label={`จำนวนคืน ${l.name}`}
                className="h-9 w-24 rounded-lg border border-input bg-transparent px-2 text-base md:text-sm"
              />
              <span className="text-sm">ชิ้น</span>
              <ConditionSelect name={`qcond:${l.id}`} label={`สภาพ ${l.name}`} />
            </div>
          )}
        </fieldset>
      ))}
      <Button type="submit" size="lg" disabled={pending}>
        บันทึกรับคืน
      </Button>
      <ErrorText state={state} />
    </form>
  );
}
