"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, undefined);

  if (state?.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>สมัครเรียบร้อย รอแอดมินยืนยัน</CardTitle>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-primary underline underline-offset-4">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>สมัครใช้งาน</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">ชื่อ-นามสกุล</Label>
            <Input id="name" name="name" autoComplete="name" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">อีเมล</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="department">หน่วยงาน</Label>
            <Input id="department" name="department" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">เบอร์โทร</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" required />
          </div>
          {state && !state.ok && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending} className="h-10">
            {pending ? "กำลังสมัคร..." : "สมัครใช้งาน"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            มีบัญชีแล้ว?{" "}
            <Link href="/login" className="text-primary underline underline-offset-4">
              เข้าสู่ระบบ
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
