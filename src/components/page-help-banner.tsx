"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { helpFor } from "@/lib/page-help";

/** Short "what this page is for / what to do next" line at the top of every app page. */
export function PageHelpBanner() {
  const help = helpFor(usePathname());
  if (!help) return null;
  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground"
    >
      <span aria-hidden className="mt-0.5 text-primary">
        ℹ
      </span>
      <p className="flex-1">
        {help.text}{" "}
        <Link href="/help" className="whitespace-nowrap text-primary underline-offset-4 hover:underline">
          ดูวิธีใช้ทั้งหมด
        </Link>
      </p>
    </div>
  );
}
