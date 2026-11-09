import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import { todayBangkok } from "@/lib/dates";
import { requireRole } from "@/server/auth/session";
import { getItem } from "@/server/inventory/items";
import { availableQuantity } from "@/server/loans/availability";
import { AddToCart } from "./add-to-cart";

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("BORROWER", "STAFF", "ADMIN");
  const { id } = await params;
  const item = await getItem(id);
  if (!item || !item.active) notFound();
  const today = todayBangkok();
  const avail = await availableQuantity(prisma, id, today, today);

  return (
    <div className="space-y-4">
      {item.imagePath ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/uploads/${item.imagePath}`} alt={item.name} className="max-h-72 w-full rounded-lg object-cover" />
      ) : null}
      <h1 className="text-xl font-semibold">{item.name}</h1>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">{item.category.name}</Badge>
        <Badge variant={avail > 0 ? "default" : "secondary"}>ว่างวันนี้ {avail}</Badge>
        <span className="text-muted-foreground">ยืมได้ไม่เกิน {item.maxLoanDays} วัน</span>
      </div>
      {item.description && <p className="whitespace-pre-wrap text-sm">{item.description}</p>}
      <AddToCart itemId={item.id} />
    </div>
  );
}
