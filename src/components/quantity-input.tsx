"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

function parse(raw: string): number | null {
  const s = raw.trim().replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)));
  return /^\d+$/.test(s) ? Number(s) : null;
}

/**
 * Whole-number quantity with − / + buttons. The box may be empty while typing
 * (so clearing it and typing "3" gives 3, not 13); the value is clamped to
 * [min, max] when the box loses focus.
 */
export function QuantityInput({
  value,
  onChange,
  min = 1,
  max,
  label,
  className,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.max(min, max !== undefined ? Math.min(max, n) : n);

  function commit() {
    if (draft === null) return;
    const n = parse(draft);
    onChange(clamp(n ?? value));
    setDraft(null);
  }

  const btn =
    "grid size-9 shrink-0 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className={cn("inline-flex h-9 items-stretch overflow-hidden rounded-lg border border-input bg-background", className)}>
      <button type="button" className={btn} aria-label="ลดลง 1" disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>
        <Minus className="size-4" aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parse(e.target.value);
          if (n !== null && n >= min && (max === undefined || n <= max)) onChange(n);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        className="w-12 border-x border-input bg-transparent text-center text-base tabular-nums outline-none focus-visible:bg-brand-surface md:text-sm"
      />
      <button
        type="button"
        className={btn}
        aria-label="เพิ่มขึ้น 1"
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
