"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_EVENT, readCart } from "@/components/cart-store";
import { cn } from "@/lib/utils";

/** "ตะกร้า" button that shows how many different items are in the cart. */
export function CartLink({ className }: { className?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(readCart().length);
    update();
    window.addEventListener(CART_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(CART_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `ตะกร้า (${count} รายการ)` : "ตะกร้า"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted",
        count > 0 && "border-primary/40 text-primary",
        className,
      )}
    >
      ตะกร้า
      {count > 0 && (
        <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-semibold text-primary-foreground tabular-nums">
          {count}
        </span>
      )}
    </Link>
  );
}
