import { expect, test } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { assertRole, type SessionUser } from "@/server/auth/session";

test("hash/verify", async () => {
  const h = await hashPassword("secret123");
  expect(h).toMatch(/^\$2[aby]\$12\$/);
  expect(await verifyPassword("secret123", h)).toBe(true);
  expect(await verifyPassword("wrong", h)).toBe(false);
});
test("assertRole: ADMIN passes STAFF check, BORROWER fails", () => {
  expect(() => assertRole({ role: "ADMIN" } as SessionUser, "STAFF")).not.toThrow();
  expect(() => assertRole({ role: "STAFF" } as SessionUser, "STAFF")).not.toThrow();
  expect(() => assertRole({ role: "BORROWER" } as SessionUser, "STAFF")).toThrow("ไม่มีสิทธิ์");
  expect(() => assertRole({ role: "STAFF" } as SessionUser, "ADMIN")).toThrow("ไม่มีสิทธิ์");
});
