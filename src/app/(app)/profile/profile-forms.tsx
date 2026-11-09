"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordAction,
  createLinkCodeAction,
  unlinkLineAction,
  updateProfileAction,
  type ActionState,
} from "./actions";

function Msg({ state, ok }: { state: ActionState; ok: string }) {
  if (!state) return null;
  return state.ok ? (
    <p className="text-sm text-green-700">{ok}</p>
  ) : (
    <p role="alert" className="text-sm text-destructive">
      {state.error}
    </p>
  );
}

export function ProfileForm({ user }: { user: { name: string; department: string; phone: string } }) {
  const [state, action, pending] = useActionState(updateProfileAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="name">ชื่อ-นามสกุล</Label>
        <Input id="name" name="name" defaultValue={user.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="department">หน่วยงาน</Label>
        <Input id="department" name="department" defaultValue={user.department} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">เบอร์โทร</Label>
        <Input id="phone" name="phone" type="tel" defaultValue={user.phone} required />
      </div>
      <Msg state={state} ok="บันทึกแล้ว" />
      <Button type="submit" disabled={pending} className="h-10">
        บันทึก
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form key={state?.ok ? "done" : "form"} action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="current">รหัสผ่านปัจจุบัน</Label>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="next">รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)</Label>
        <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <Msg state={state} ok="เปลี่ยนรหัสผ่านแล้ว" />
      <Button type="submit" disabled={pending} className="h-10">
        เปลี่ยนรหัสผ่าน
      </Button>
    </form>
  );
}

const fmt = new Intl.DateTimeFormat("th-TH", { timeStyle: "short", timeZone: "Asia/Bangkok" });

export function LineSection({
  linked,
  qrDataUrl,
  addFriendUrl,
}: {
  linked: boolean;
  qrDataUrl: string | null;
  addFriendUrl: string;
}) {
  const [pending, start] = useTransition();
  const [issued, setIssued] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (linked) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">ผูกแล้ว</p>
        <form
          action={() =>
            start(async () => {
              const r = await unlinkLineAction();
              if (r && !r.ok) setError(r.error);
            })
          }
          onSubmit={(e) => {
            if (!confirm("ยืนยันการยกเลิกการผูก LINE?")) e.preventDefault();
          }}
        >
          <Button type="submit" variant="destructive" disabled={pending}>
            ยกเลิกการผูก
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        disabled={pending}
        className="h-10"
        onClick={() =>
          start(async () => {
            const r = await createLinkCodeAction();
            if (r.ok) {
              setIssued(r.data);
              setError(null);
            } else setError(r.error);
          })
        }
      >
        ผูก LINE
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {issued && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-sm">เพิ่มเพื่อน LINE OA แล้วพิมพ์รหัสนี้ส่งในแชท</p>
          <p className="text-3xl font-bold tracking-widest">{issued.code}</p>
          <p className="text-xs text-muted-foreground">
            หมดอายุเวลา {fmt.format(new Date(issued.expiresAt))} น. (อายุ 10 นาที)
          </p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR เพิ่มเพื่อน LINE" className="size-40" />
          )}
          {addFriendUrl && (
            <a href={addFriendUrl} className="text-sm text-primary underline underline-offset-4">
              เปิดลิงก์เพิ่มเพื่อน LINE
            </a>
          )}
        </div>
      )}
    </div>
  );
}
