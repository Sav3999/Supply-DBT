"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import type { NavItem } from "@/components/nav";
import { cn } from "@/lib/utils";

/** The menu entry whose href is the longest prefix of the current path (so /staff/items/5 → "จัดการของ"). */
function activeHref(items: NavItem[], pathname: string): string | null {
  let best: string | null = null;
  for (const i of items) {
    const hit = pathname === i.href || pathname.startsWith(`${i.href}/`);
    if (hit && (!best || i.href.length > best.length)) best = i.href;
  }
  // the cart and item pages belong to "รายการของ"
  if (!best && (pathname === "/cart" || pathname.startsWith("/items"))) best = "/items";
  return best;
}

/**
 * Top menu with a blue bar that slides under the current page.
 * Motion is skipped for people who ask their device for less motion.
 */
export function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const active = activeHref(items, pathname);
  const navRef = useRef<HTMLElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const el = nav.querySelector<HTMLElement>('[aria-current="page"]');
      setBar((prev) => {
        if (!el) return null;
        const next = { left: el.offsetLeft, width: el.offsetWidth };
        return prev && prev.left === next.left && prev.width === next.width ? prev : next;
      });
    };
    measure();
    // widths change once the Thai web font arrives, and on resize
    const frame = requestAnimationFrame(measure);
    void document.fonts?.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    // keep the current entry visible on phones where the menu scrolls sideways
    nav.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [active]);

  return (
    <nav ref={navRef} className="relative flex gap-1 overflow-x-auto pb-1.5">
      {items.map((i) => {
        const current = i.href === active;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors duration-200",
              current ? "font-medium text-primary" : "text-foreground/80 hover:bg-muted hover:text-foreground",
            )}
          >
            {i.label}
          </Link>
        );
      })}
      {bar && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary motion-safe:transition-[left,width] motion-safe:duration-300 motion-safe:ease-out"
          style={{ left: bar.left + 8, width: Math.max(bar.width - 16, 12) }}
        />
      )}
    </nav>
  );
}
