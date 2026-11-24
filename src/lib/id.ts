import { AppError } from "@/lib/result";

/**
 * Parse a record id (from a URL segment, form field or JWT) into a positive
 * integer. Returns null for anything else, so callers can show "not found".
 */
export function parseId(v: unknown): number | null {
  if (typeof v === "number") return Number.isSafeInteger(v) && v > 0 ? v : null;
  if (typeof v !== "string" || !/^\d{1,15}$/.test(v.trim())) return null;
  const n = Number(v.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Like parseId but throws a Thai AppError, for use inside toResult(). */
export function requireId(v: unknown): number {
  const id = parseId(v);
  if (id === null) throw new AppError("ไม่พบข้อมูล");
  return id;
}
