import { describe, expect, test } from "vitest";
import { helpFor } from "@/lib/page-help";
import { navFor } from "@/components/nav";

describe("helpFor", () => {
  test("every menu page has a description", () => {
    for (const role of ["BORROWER", "STAFF", "ADMIN"] as const) {
      for (const item of navFor(role).filter((i) => i.href !== "/help")) {
        expect(helpFor(item.href), item.href).not.toBeNull();
      }
    }
  });

  test("cart tells the user where to follow up", () => {
    expect(helpFor("/cart")?.text).toContain("คำขอของฉัน");
  });

  test("matches dynamic pages by pattern", () => {
    expect(helpFor("/my-loans/abc123")).toEqual(helpFor("/my-loans/xyz"));
    expect(helpFor("/staff/loans/abc123")?.text).toContain("ส่งมอบ");
    expect(helpFor("/staff/items/abc123")?.text).toContain("แก้ไข");
  });

  test("ignores query strings and trailing slashes", () => {
    expect(helpFor("/staff/loans/?status=OVERDUE")).toEqual(helpFor("/staff/loans"));
  });

  test("unknown or help page itself has no banner", () => {
    expect(helpFor("/nope")).toBeNull();
    expect(helpFor("/help")).toBeNull();
  });
});

describe("navFor", () => {
  test("every role sees the วิธีใช้ menu item last", () => {
    for (const role of ["BORROWER", "STAFF", "ADMIN"] as const) {
      expect(navFor(role).at(-1)).toEqual({ label: "วิธีใช้", href: "/help" });
    }
  });
});
