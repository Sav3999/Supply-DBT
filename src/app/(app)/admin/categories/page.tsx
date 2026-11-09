import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/server/auth/session";
import { listCategories } from "@/server/inventory/categories";
import { createCategoryAction, deleteCategoryAction, renameCategoryAction } from "./actions";
import { AddCategoryForm, DeleteForm, RenameForm } from "./category-controls";

export default async function AdminCategoriesPage() {
  await requireRole("ADMIN");
  const categories = await listCategories();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">จัดการหมวดหมู่</h1>
      <AddCategoryForm action={createCategoryAction} />
      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีหมวดหมู่</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อหมวดหมู่</TableHead>
                <TableHead>จำนวนของ</TableHead>
                <TableHead>การดำเนินการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <RenameForm action={renameCategoryAction} id={c.id} name={c.name} />
                  </TableCell>
                  <TableCell>{c._count.items}</TableCell>
                  <TableCell>
                    <DeleteForm action={deleteCategoryAction} id={c.id} />
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
