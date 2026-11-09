import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/db";
import { todayBangkok } from "@/lib/dates";
import { requireRole } from "@/server/auth/session";
import { listCategories } from "@/server/inventory/categories";
import { listItems } from "@/server/inventory/items";
import { availableQuantity } from "@/server/loans/availability";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string }>;
}) {
  await requireRole("BORROWER", "STAFF", "ADMIN");
  const { q, categoryId } = await searchParams;
  const [items, categories] = await Promise.all([
    listItems({ q, categoryId: categoryId || undefined }),
    listCategories(),
  ]);
  const today = todayBangkok();
  const avail = await Promise.all(items.map((i) => availableQuantity(prisma, i.id, today, today)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">รายการของ</h1>
        <Link href="/cart" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">
          ตะกร้า
        </Link>
      </div>
      <form className="flex flex-wrap gap-2">
        <Input name="q" defaultValue={q ?? ""} placeholder="ค้นหาชื่อของ" className="flex-1" />
        <select
          name="categoryId"
          defaultValue={categoryId ?? ""}
          aria-label="หมวดหมู่"
          className="h-10 rounded-lg border border-input bg-background px-2 text-base md:text-sm"
        >
          <option value="">ทุกหมวดหมู่</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button type="submit">ค้นหา</Button>
      </form>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">ไม่พบของ</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {items.map((i, idx) => (
            <Link key={i.id} href={`/items/${i.id}`}>
              <Card className="h-full hover:bg-muted">
                {i.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/uploads/${i.imagePath}`} alt={i.name} className="h-36 w-full rounded-lg object-cover" />
                ) : (
                  <div className="flex h-36 w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                    ไม่มีรูป
                  </div>
                )}
                <div className="space-y-1">
                  <p className="font-medium">{i.name}</p>
                  <p className="text-sm text-muted-foreground">{i.category.name}</p>
                  <Badge variant={avail[idx] > 0 ? "default" : "secondary"}>ว่างวันนี้ {avail[idx]}</Badge>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
