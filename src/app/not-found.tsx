import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-10 text-center">
      <h1 className="text-xl font-semibold">ไม่พบหน้าที่ต้องการ</h1>
      <p className="text-sm text-muted-foreground">หน้าที่คุณเรียกอาจถูกลบหรือไม่มีอยู่</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        กลับหน้าแรก
      </Link>
    </main>
  );
}
