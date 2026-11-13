import { addDays, formatDateOnly, todayBangkok } from "@/lib/dates";
import { requirePageRole } from "@/server/auth/session";
import { CartForm } from "./cart-form";

export default async function CartPage() {
  await requirePageRole("BORROWER", "STAFF", "ADMIN");
  const today = todayBangkok();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">ตะกร้า</h1>
      <CartForm today={formatDateOnly(today)} tomorrow={formatDateOnly(addDays(today, 1))} />
    </div>
  );
}
