"use client";

import { useState } from "react";
import Link from "next/link";
import { addToCart } from "@/components/cart-store";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/quantity-input";

export function AddToCart({ itemId }: { itemId: number }) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <QuantityInput
          value={qty}
          label="จำนวน"
          onChange={(n) => {
            setQty(n);
            setAdded(false);
          }}
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
        <p className="text-sm text-status-returned">
          เพิ่มลงตะกร้าแล้ว {qty} ชิ้น{" "}
          <Link href="/cart" className="text-primary underline underline-offset-4">
            ไปที่ตะกร้า
          </Link>
        </p>
      )}
    </div>
  );
}
