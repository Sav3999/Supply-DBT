import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePageRole } from "@/server/auth/session";
import { listCategories } from "@/server/inventory/categories";
import { getItem } from "@/server/inventory/items";
import { addAssetAction, assetStatusAction, setActiveAction, updateItemAction, uploadImageAction } from "../actions";
import { ActiveForm, AddAssetForm, AssetStatusSelect, ImageForm, ItemForm } from "../item-controls";

export default async function StaffItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageRole("STAFF");
  const { id } = await params;
  const [item, categories] = await Promise.all([getItem(id), listCategories()]);
  if (!item) notFound();

  return (
    <div className="space-y-6">
      <Link href="/staff/items" className="text-sm text-muted-foreground hover:underline">
        ← กลับไปรายการของ
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
        {item.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/uploads/${item.imagePath}`} alt={item.name} className="max-h-48 rounded-lg" />
        ) : (
          <p className="text-sm text-muted-foreground">ยังไม่มีรูป</p>
        )}
        <ImageForm action={uploadImageAction} id={item.id} />
        <p className="text-xs text-muted-foreground">รองรับ jpg, png, webp ไม่เกิน 5MB</p>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.assets.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.assetTag}</TableCell>
                      <TableCell>
                        <AssetStatusSelect action={assetStatusAction} itemId={item.id} assetId={a.id} status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
