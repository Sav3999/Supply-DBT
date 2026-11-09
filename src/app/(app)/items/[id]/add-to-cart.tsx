"use client";

import { useState } from "react";
import Link from "next/link";
import { addToCart } from "@/components/cart-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddToCart({ itemId }: { itemId: string }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          value={qty}
          aria-label="จำนวน"
          onChange={(e) => {
            setQty(Math.max(1, Math.floor(Number(e.target.value)) || 1));
            setAdded(false);
          }}
          className="w-24"
        />
        <Button
          type="button"
          onClick={() => {
            addToCart(itemId, qty);
            setAdded(true);
          }}
        >
          เพิ่มลงตะกร้า
        </Button>
      </div>
      {added && (
        <p className="text-sm text-muted-foreground">
          เพิ่มลงตะกร้าแล้ว{" "}
          <Link href="/cart" className="underline">
            ไปที่ตะกร้า
          </Link>
        </p>
      )}
    </div>
  );
}
