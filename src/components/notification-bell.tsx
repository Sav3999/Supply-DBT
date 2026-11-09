"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function NotificationBell() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/notifications/unread", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { count: number };
        if (!cancelled) setCount(data.count);
      } catch {
        /* ignore transient errors */
      }
    };
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [pathname]);

  return (
    <Link
      href="/notifications"
      aria-label={`การแจ้งเตือน${count > 0 ? ` (${count} ยังไม่อ่าน)` : ""}`}
      className="relative rounded-md px-2 py-1 hover:bg-muted"
    >
      <span aria-hidden>🔔</span>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] leading-4 text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
