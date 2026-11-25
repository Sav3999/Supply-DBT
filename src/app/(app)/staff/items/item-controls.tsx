"use client";

import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { shrinkImage } from "@/lib/image-fit";
import { useFormAction } from "@/lib/use-form-action";
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
  const { state, pending, form } = useFormAction(action, null, {
    // phone photos are often over 5MB — shrink in the browser before sending
    prepare: async (fd) => {
      const file = fd.get("image");
      if (file instanceof File && file.size > 0) fd.set("image", await shrinkImage(file));
      return fd;
    },
  });
  const [kind, setKind] = useState(item?.kind ?? "QUANTITY");
  return (
    <form {...form} className="space-y-3">
      {item && <input type="hidden" name="id" value={item.id} />}
      {!item && <NewItemImage />}
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
          <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className={selectClass}>
            <option value="QUANTITY">นับเป็นจำนวน</option>
            <option value="SERIALIZED">มีเลขครุภัณฑ์</option>
          </select>
        )}
      </div>
      {kind === "QUANTITY" && (
        <div className="space-y-1">
          <Label htmlFor="totalQuantity">จำนวนรวม</Label>
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
      {state?.ok && <p className="text-xs text-status-returned">บันทึกแล้ว</p>}
      {!item && (
        <p className="text-xs text-muted-foreground">
          {kind === "SERIALIZED" ? "เพิ่มเลขครุภัณฑ์ได้ในหน้าถัดไปหลังกดเพิ่มของ" : "แก้ไขข้อมูลและเปลี่ยนรูปได้ภายหลังในหน้าของชิ้นนี้"}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "กำลังบันทึก..." : item ? "บันทึก" : "เพิ่มของ"}
      </Button>
    </form>
  );
}

/** Picture picker for the "add item" form (first field), with a preview. */
function NewItemImage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    setError(null);
    if (!file) return setPreview(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      e.currentTarget.value = "";
      setPreview(null);
      return setError("รองรับเฉพาะไฟล์ jpg, png, webp");
    }
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">รูปภาพ (ไม่บังคับ)</span>
      <div className="flex items-center gap-3">
        <label
          htmlFor="new-item-image"
          className="relative grid aspect-[4/3] w-28 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border border-dashed bg-brand-surface text-xs text-muted-foreground hover:border-primary/50"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="รูปที่เลือก" className="absolute inset-0 size-full object-contain" />
          ) : (
            "ยังไม่มีรูป"
          )}
        </label>
        <div className="flex flex-col items-start gap-1">
          <label
            htmlFor="new-item-image"
            className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            {preview ? "เปลี่ยนรูป" : "เลือกรูป"}
          </label>
          {preview && (
            <button
              type="button"
              className="text-xs text-destructive hover:underline"
              onClick={() => {
                const input = document.getElementById("new-item-image") as HTMLInputElement | null;
                if (input) input.value = "";
                setPreview(null);
              }}
            >
              เอารูปออก
            </button>
          )}
          <p className="text-xs text-muted-foreground">jpg, png, webp · รูปจากมือถือจะถูกย่อให้อัตโนมัติ</p>
        </div>
      </div>
      <input
        id="new-item-image"
        name="image"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label="รูปภาพ"
        onChange={onPick}
        className="sr-only"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function ImageForm({
  action,
  removeAction,
  id,
  hasImage,
}: {
  action: Action;
  removeAction: Action;
  id: number;
  hasImage: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const remove = useFormAction(removeAction, null, { confirm: "ลบรูปของชิ้นนี้ใช่ไหม?" });
  const [preparing, startPreparing] = useTransition();
  const [localError, setLocalError] = useState<string | null>(null);
  const inputId = `image-${id}`;

  // upload as soon as a file is picked — no second button to forget
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    setLocalError(null);
    if (!file) return;
    startPreparing(async () => {
      // phone photos are often over 5MB — shrink in the browser before sending
      const small = await shrinkImage(file);
      input.value = "";
      if (small.size > MAX_IMAGE_BYTES) {
        setLocalError("ไฟล์ใหญ่เกิน 5MB และย่อขนาดอัตโนมัติไม่ได้ ลองใช้รูป jpg หรือ png");
        return;
      }
      const fd = new FormData();
      fd.set("id", String(id));
      fd.set("image", small);
      // after an await the outer transition context is gone, so dispatch in a fresh one
      startTransition(() => formAction(fd));
    });
  }

  const busy = pending || preparing;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="รูปภาพ"
          onChange={onPick}
          disabled={busy}
          className="sr-only"
        />
        <label
          htmlFor={inputId}
          aria-disabled={busy}
          className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          {busy ? "กำลังอัปโหลด..." : hasImage ? "เปลี่ยนรูป" : "เลือกรูป"}
        </label>
        {hasImage && (
          <form {...remove.form}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" size="sm" variant="ghost" disabled={busy || remove.pending} className="text-destructive hover:text-destructive">
              ลบรูป
            </Button>
          </form>
        )}
      </div>
      {localError && <p className="text-xs text-destructive">{localError}</p>}
      <Err state={state} />
      <Err state={remove.state} />
      {state?.ok && !busy && hasImage && <p className="text-xs text-status-returned">อัปโหลดรูปแล้ว</p>}
    </div>
  );
}

export function ActiveForm({ action, id, active }: { action: Action; id: number; active: boolean }) {
  const { state, pending, form } = useFormAction(action, null);
  return (
    <form {...form} className="inline-flex flex-col gap-1">
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
  const { state, pending, form } = useFormAction(action, null, { resetOnSuccess: true });
  return (
    <form {...form} className="space-y-1">
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

export function DeleteItemForm({ action, id, name }: { action: Action; id: number; name: string }) {
  const { state, pending, form } = useFormAction(action, null, {
    confirm: `ลบ “${name}” ออกจากระบบใช่ไหม? ลบแล้วกู้คืนไม่ได้`,
  });
  return (
    <form {...form} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "กำลังลบ..." : "ลบของนี้"}
      </Button>
      <Err state={state} />
    </form>
  );
}

export function DeleteAssetForm({ action, itemId, assetId, assetTag }: { action: Action; itemId: number; assetId: number; assetTag: string }) {
  const { state, pending, form } = useFormAction(action, null, {
    confirm: `ลบเลขครุภัณฑ์ ${assetTag} ใช่ไหม?`,
  });
  return (
    <form {...form} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={itemId} />
      <input type="hidden" name="assetId" value={assetId} />
      <Button type="submit" size="sm" variant="ghost" disabled={pending} className="text-destructive hover:text-destructive" aria-label={`ลบ ${assetTag}`}>
        ลบ
      </Button>
      <Err state={state} />
    </form>
  );
}
