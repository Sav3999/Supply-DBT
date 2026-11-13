"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 py-10 text-center">
      <h1 className="text-xl font-semibold">เกิดข้อผิดพลาด</h1>
      <p className="text-sm text-muted-foreground">ขออภัย ระบบไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง</p>
      {error.digest ? (
        <p className="text-sm">
          รหัสอ้างอิง: <code className="rounded bg-muted px-1.5 py-0.5">{error.digest}</code>
        </p>
      ) : process.env.NODE_ENV !== "production" ? (
        <p className="text-sm text-muted-foreground">{error.message}</p>
      ) : null}
      <div className="flex justify-center gap-2">
        <Button onClick={() => reset()}>ลองใหม่</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          หน้าแรก
        </Link>
      </div>
    </div>
  );
}
