import { describe, expect, test } from "vitest";
import { itemSchema } from "@/server/inventory/items";

const base = { name: "เมาส์", categoryId: "c1", kind: "QUANTITY" as const, totalQuantity: "5", maxLoanDays: "7" };

function firstError(input: Record<string, unknown>): string | undefined {
  const r = itemSchema.safeParse(input);
  return r.success ? undefined : r.error.issues[0]?.message;
}

describe("itemSchema numbers from form fields", () => {
  test("empty quantity is an error, not a silent 0", () => {
    expect(firstError({ ...base, totalQuantity: "" })).toBe("กรุณากรอกจำนวนรวม");
  });

  test("non-numeric quantity is an error", () => {
    expect(firstError({ ...base, totalQuantity: "abc" })).toBe("จำนวนต้องเป็นตัวเลข");
  });

  test("accepts Thai digits and surrounding spaces", () => {
    const r = itemSchema.parse({ ...base, totalQuantity: " ๑๒ ", maxLoanDays: "๗" });
    expect(r.totalQuantity).toBe(12);
    expect(r.maxLoanDays).toBe(7);
  });

  test("still accepts plain numbers and numeric strings", () => {
    expect(itemSchema.parse({ ...base, totalQuantity: 3 }).totalQuantity).toBe(3);
    expect(itemSchema.parse({ ...base, totalQuantity: "40" }).totalQuantity).toBe(40);
  });

  test("serialized items may omit quantity (defaults to 0)", () => {
    expect(itemSchema.parse({ ...base, totalQuantity: undefined, kind: "SERIALIZED" }).totalQuantity).toBe(0);
  });

  test("empty max loan days is an error", () => {
    expect(firstError({ ...base, maxLoanDays: "" })).toBe("กรุณากรอกจำนวนวันที่ยืมได้");
  });
});
