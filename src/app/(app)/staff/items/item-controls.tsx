"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shrinkImage } from "@/lib/image-fit";
import type { ActionState } from "./actions";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export const STATUS_LABEL = {
  AVAILABLE: "ว่าง",
  ON_LOAN: "ถูกยืม",
  REPAIR: "ซ่อม",
  LOST: "สูญหาย",
  RETIRED: "เลิกใช้",
} as const;

function Err({ state }: { state: ActionState }) {
  return state && !state.ok ? <p className="text-xs text-destructive">{state.error}</p> : null;
}

const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-2 text-base md:text-sm";

export function ItemForm({
  action,
  categories,
  item,
}: {
  action: Action;
  categories: { id: number; name: string }[];
  item?: {
    id: number;
    name: string;
    categoryId: number;
    description: string | null;
    kind: "SERIALIZED" | "QUANTITY";
    totalQuantity: number;
    maxLoanDays: number;
  };
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-3">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="space-y-1">
        <Label htmlFor="name">ชื่อของ</Label>
        <Input id="name" name="name" required defaultValue={item?.name} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="categoryId">หมวดหมู่</Label>
        <select id="categoryId" name="categoryId" required defaultValue={item?.categoryId ?? ""} className={selectClass}>
          <option value="" disabled>
            เลือกหมวดหมู่
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">รายละเอียด</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={item?.description ?? ""}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="kind">ประเภท</Label>
        {item ? (
          <>
            <input type="hidden" name="kind" value={item.kind} />
            <p className="text-sm">{item.kind === "SERIALIZED" ? "มีเลขครุภัณฑ์" : "นับเป็นจำนวน"}</p>
          </>
        ) : (
          <select id="kind" name="kind" defaultValue="QUANTITY" className={selectClass}>
            <option value="QUANTITY">นับเป็นจำนวน</option>
            <option value="SERIALIZED">มีเลขครุภัณฑ์</option>
          </select>
        )}
      </div>
      {(!item || item.kind === "QUANTITY") && (
        <div className="space-y-1">
          <Label htmlFor="totalQuantity">จำนวนรวม (เฉพาะของนับเป็นจำนวน)</Label>
          <Input
            id="totalQuantity"
            name="totalQuantity"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={item?.totalQuantity ?? 0}
          />
          <p className="text-xs text-muted-foreground">ใส่จำนวนทั้งหมดที่มี เช่น มี 10 ชิ้น ใส่ 10</p>
        </div>
      )}
      {item?.kind === "SERIALIZED" && (
        <p className="text-sm text-muted-foreground">
          ของประเภทนี้นับจำนวนจากเลขครุภัณฑ์ เพิ่มจำนวนได้ที่ส่วน &quot;เลขครุภัณฑ์&quot; ด้านล่าง
        </p>
      )}
      <div className="space-y-1">
        <Label htmlFor="maxLoanDays">ยืมได้สูงสุด (วัน)</Label>
        <Input id="maxLoanDays" name="maxLoanDays" inputMode="numeric" autoComplete="off" required defaultValue={item?.maxLoanDays ?? 7} />
      </div>
      <Err state={state} />
      {state?.ok && <p className="text-xs text-muted-foreground">บันทึกแล้ว</p>}
      {!item && <p className="text-xs text-muted-foreground">เพิ่มรูปและเลขครุภัณฑ์ได้ในหน้าถัดไปหลังกดเพิ่มของ</p>}
      <Button type="submit" disabled={pending}>
        {item ? "บันทึก" : "เพิ่มของ"}
      </Button>
    </form>
  );
}

export function ImageForm({ action, id }: { action: Action; id: number }) {
  const [state, formAction, pending] = useActionState(action, null);
  const [preparing, startPreparing] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const file = (form.elements.namedItem("image") as HTMLInputElement | null)?.files?.[0];
    setLocalError(null);
    if (!file) {
      setLocalError("กรุณาเลือกไฟล์รูป");
      return;
    }
    startPreparing(async () => {
      // phone photos are often over 5MB — shrink in the browser before sending
      const small = await shrinkImage(file);
      if (small.size > MAX_IMAGE_BYTES) {
        setLocalError("ไฟล์ใหญ่เกิน 5MB และย่อขนาดอัตโนมัติไม่ได้ ลองใช้รูป jpg หรือ png");
        return;
      }
      const fd = new FormData();
      fd.set("id", String(id));
      fd.set("image", small);
      // after an await the outer transition context is gone, so dispatch in a fresh one
      startTransition(() => formAction(fd));
      form.reset();
    });
  }

  const busy = pending || preparing;
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Input name="image" type="file" accept="image/jpeg,image/png,image/webp" required aria-label="รูปภาพ" />
      {localError && <p className="text-xs text-destructive">{localError}</p>}
      <Err state={state} />
      {state?.ok && !busy && <p className="text-xs text-muted-foreground">อัปโหลดรูปแล้ว</p>}
      <Button type="submit" size="sm" variant="outline" disabled={busy}>
        {busy ? "กำลังอัปโหลด..." : "อัปโหลดรูป"}
      </Button>
    </form>
  );
}

export function ActiveForm({ action, id, active }: { action: Action; id: number; active: boolean }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={String(!active)} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {active ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
      </Button>
      <Err state={state} />
    </form>
  );
}

export function AddAssetForm({ action, id }: { action: Action; id: number }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <div className="flex gap-2">
        <Input name="assetTag" required placeholder="เลขครุภัณฑ์" aria-label="เลขครุภัณฑ์" />
        <Button type="submit" disabled={pending}>
          เพิ่ม
        </Button>
      </div>
      <Err state={state} />
    </form>
  );
}

export function AssetStatusSelect({
  action,
  itemId,
  assetId,
  status,
}: {
  action: Action;
  itemId: number;
  assetId: number;
  status: keyof typeof STATUS_LABEL;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  if (status === "ON_LOAN") return <span className="text-sm">{STATUS_LABEL.ON_LOAN}</span>;
  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="assetId" value={assetId} />
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        aria-label="สถานะ"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
      >
        {(["AVAILABLE", "REPAIR", "LOST", "RETIRED"] as const).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <Err state={state} />
    </form>
  );
}
