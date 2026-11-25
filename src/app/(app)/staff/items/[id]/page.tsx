import { parseId } from "@/lib/id";
import { ItemImage } from "@/components/item-image";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePageRole } from "@/server/auth/session";
import { listCategories } from "@/server/inventory/categories";
import { getItem, itemDeleteInfo } from "@/server/inventory/items";
import {
  addAssetAction,
  assetStatusAction,
  deleteAssetAction,
  deleteItemAction,
  removeImageAction,
  setActiveAction,
  updateItemAction,
  uploadImageAction,
} from "../actions";
import { ActiveForm, AddAssetForm, AssetStatusSelect, DeleteAssetForm, DeleteItemForm, ImageForm, ItemForm } from "../item-controls";

export default async function StaffItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole("STAFF");
  const id = parseId((await params).id);
  if (id === null) notFound();
  const [item, categories, usage] = await Promise.all([getItem(id), listCategories(), itemDeleteInfo(id)]);
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <Link href="/staff/items" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft aria-hidden className="size-4" />
        กลับไปรายการของ
      </Link>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{item.name}</h1>
        <div className="flex items-center gap-2">
          <Badge variant={item.active ? "default" : "secondary"}>{item.active ? "เปิดใช้งาน" : "ปิดใช้งาน"}</Badge>
          <ActiveForm action={setActiveAction} id={item.id} active={item.active} />
        </div>
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">รูปภาพ</h2>
        <ItemImage src={item.imagePath} alt={item.name} emptyText="ยังไม่มีรูป" className="max-w-64" />
        <ImageForm action={uploadImageAction} removeAction={removeImageAction} id={item.id} hasImage={Boolean(item.imagePath)} />
        <p className="text-xs text-muted-foreground">รองรับ jpg, png, webp · รูปจากมือถือจะถูกย่อให้อัตโนมัติ</p>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">ข้อมูลของ</h2>
        <ItemForm action={updateItemAction} categories={categories} item={item} />
      </section>

      {item.kind === "SERIALIZED" && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-medium">เลขครุภัณฑ์ ({item.assets.length})</h2>
          <AddAssetForm action={addAssetAction} id={item.id} />
          {item.assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">ยังไม่มีเลขครุภัณฑ์</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>เลขครุภัณฑ์</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead className="text-right">ลบ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.assets.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.assetTag}</TableCell>
                      <TableCell>
                        <AssetStatusSelect action={assetStatusAction} itemId={item.id} assetId={a.id} status={a.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {usage.lentAssetIds.has(a.id) ? (
                          <span className="text-xs text-muted-foreground">มีประวัติการยืม</span>
                        ) : (
                          <DeleteAssetForm action={deleteAssetAction} itemId={item.id} assetId={a.id} assetTag={a.assetTag} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}

      <section className="space-y-2 rounded-lg border border-destructive/30 p-4">
        <h2 className="font-medium">ลบของ</h2>
        {usage.loanCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            ลบไม่ได้ เพราะของนี้มีประวัติการยืม {usage.loanCount} ครั้ง (เก็บไว้เป็นหลักฐาน) ถ้าไม่ใช้แล้วให้กด “ปิดการใช้งาน” ด้านบน
            ผู้ยืมจะไม่เห็นของนี้อีก
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">ของนี้ยังไม่เคยถูกยืม ลบออกจากระบบได้ (รวมเลขครุภัณฑ์ทั้งหมด)</p>
            <DeleteItemForm action={deleteItemAction} id={item.id} name={item.name} />
          </>
        )}
      </section>
    </div>
  );
}
