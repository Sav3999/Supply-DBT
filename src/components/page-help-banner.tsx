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
      className="mb-4 rounded-r-lg border-l-4 border-primary bg-brand-surface px-3 py-2 text-sm text-foreground"
    >
      <p>
        {help.text}{" "}
        <Link href="/help" className="whitespace-nowrap text-primary underline-offset-4 hover:underline">
          ดูวิธีใช้ทั้งหมด
        </Link>
      </p>
    </div>
  );
}
