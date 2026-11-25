"use client";

import { useState } from "react";
import Link from "next/link";
import { addToCart } from "@/components/cart-store";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/quantity-input";

export function AddToCart({ itemId }: { itemId: number }) {
  const [qty, setQty] = useState(1);
  const [inCart, setInCart] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <QuantityInput
          value={qty}
          label="จำนวน"
          onChange={(n) => {
            setQty(n);
            setInCart(null);
          }}
        />
        <Button
          type="button"
          onClick={() => {
            setInCart(addToCart(itemId, qty));
          }}
        >
          เพิ่มลงตะกร้า
        </Button>
      </div>
      {inCart !== null && (
        <p className="text-sm text-status-returned">
          เพิ่มลงตะกร้าแล้ว — ตอนนี้ในตะกร้ามีของนี้รวม {inCart} ชิ้น{" "}
          <Link href="/cart" className="text-primary underline underline-offset-4">
            ไปที่ตะกร้า
          </Link>
        </p>
      )}
    </div>
  );
}
