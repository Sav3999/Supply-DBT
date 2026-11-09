import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/server/auth/session";
import { listCategories } from "@/server/inventory/categories";
import { listItems } from "@/server/inventory/items";
import { createItemAction } from "./actions";
import { ItemForm } from "./item-controls";

export default async function StaffItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string; new?: string }>;
}) {
  await requireRole("STAFF");
  const { q, categoryId, new: isNew } = await searchParams;
  const [items, categories] = await Promise.all([
    listItems({ q, categoryId: categoryId || undefined, includeInactive: true }),
    listCategories(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">จัดการของ</h1>
        <Link href="/staff/items?new=1" className="rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground">
          เพิ่มของ
        </Link>
      </div>

      {isNew && (
        <div className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">เพิ่มของใหม่</h2>
          <ItemForm action={createItemAction} categories={categories} />
        </div>
      )}

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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>จำนวน</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <Link href={`/staff/items/${i.id}`} className="underline-offset-4 hover:underline">
                      {i.name}
                    </Link>
                  </TableCell>
                  <TableCell>{i.category.name}</TableCell>
                  <TableCell>{i.kind === "SERIALIZED" ? "มีเลขครุภัณฑ์" : "นับเป็นจำนวน"}</TableCell>
                  <TableCell>{i.kind === "SERIALIZED" ? i.assets.length : i.totalQuantity}</TableCell>
                  <TableCell>
                    <Badge variant={i.active ? "default" : "secondary"}>{i.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
