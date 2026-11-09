"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearCart, readCart, writeCart, type CartLine } from "@/components/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cartItemsAction, createLoanAction, type CartItemInfo } from "../my-loans/actions";

export function CartForm({ today, tomorrow }: { today: string; tomorrow: string }) {
  const router = useRouter();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [info, setInfo] = useState<Record<string, CartItemInfo>>({});
  const [ready, setReady] = useState(false);
  const [startDate, setStartDate] = useState(today);
  const [dueDate, setDueDate] = useState(tomorrow);
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const cart = readCart();
    if (cart.length === 0) {
      setReady(true);
      return;
    }
    cartItemsAction(cart.map((l) => l.itemId))
      .then((rows) => {
        const map = Object.fromEntries(rows.map((r) => [r.id, r]));
        // drop items that no longer exist
        const valid = cart.filter((l) => map[l.itemId]);
        setInfo(map);
        setLines(valid);
        writeCart(valid);
      })
      .catch(() => setError("โหลดตะกร้าไม่สำเร็จ"))
      .finally(() => setReady(true));
  }, []);

  function update(next: CartLine[]) {
    setLines(next);
    writeCart(next);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createLoanAction({ startDate, dueDate, purpose, items: lines });
      if (res.ok) {
        clearCart();
        router.push(`/my-loans/${res.data.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  if (!ready) return <p className="text-sm text-muted-foreground">กำลังโหลด...</p>;
  if (lines.length === 0) {
    return (
      <div className="space-y-2">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-sm text-muted-foreground">
          ตะกร้าว่าง{" "}
          <Link href="/items" className="underline">
            เลือกของที่ต้องการยืม
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="space-y-4"
    >
      <ul className="divide-y rounded-lg border">
        {lines.map((l) => (
          <li key={l.itemId} className="flex items-center justify-between gap-2 p-3">
            <span className="min-w-0 flex-1 truncate text-sm">
              {info[l.itemId]?.name}
              {info[l.itemId] && !info[l.itemId].active && <span className="ml-1 text-destructive">(ปิดใช้งาน)</span>}
            </span>
            <Input
              type="number"
              min={1}
              value={l.quantity}
              aria-label={`จำนวน ${info[l.itemId]?.name ?? ""}`}
              onChange={(e) =>
                update(
                  lines.map((x) =>
                    x.itemId === l.itemId ? { ...x, quantity: Math.max(1, Math.floor(Number(e.target.value)) || 1) } : x,
                  ),
                )
              }
              className="w-20"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => update(lines.filter((x) => x.itemId !== l.itemId))}>
              ลบ
            </Button>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="startDate">วันยืม</Label>
          <Input id="startDate" type="date" required min={today} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dueDate">วันคืน</Label>
          <Input id="dueDate" type="date" required min={startDate} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="purpose">เหตุผลการยืม</Label>
        <textarea
          id="purpose"
          required
          maxLength={500}
          rows={3}
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        ส่งคำขอยืม
      </Button>
    </form>
  );
}
