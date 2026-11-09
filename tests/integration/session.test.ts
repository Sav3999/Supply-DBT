import { beforeEach, describe, expect, test, vi } from "vitest";
import { getCurrentUser, requireRole } from "@/server/auth/session";
import { makeUser, mockSession, resetDb } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

beforeEach(async () => {
  await resetDb();
  await mockSession(null);
});

describe("getCurrentUser", () => {
  test("returns the active user", async () => {
    const u = await makeUser({ role: "STAFF" });
    await mockSession(u.id);
    expect(await getCurrentUser()).toEqual({ id: u.id, name: u.name, email: u.email, role: "STAFF" });
  });
  test("returns null with no session", async () => {
    expect(await getCurrentUser()).toBeNull();
  });
  test("returns null for suspended user with live session", async () => {
    const u = await makeUser({ status: "SUSPENDED" });
    await mockSession(u.id);
    expect(await getCurrentUser()).toBeNull();
  });
  test("returns null when user no longer exists", async () => {
    await mockSession("00000000-0000-0000-0000-000000000000");
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("requireRole", () => {
  test("rejects without session", async () => {
    await expect(requireRole("BORROWER")).rejects.toThrow("ไม่มีสิทธิ์");
  });
  test("rejects borrower for STAFF", async () => {
    const u = await makeUser();
    await mockSession(u.id);
    await expect(requireRole("STAFF")).rejects.toThrow("ไม่มีสิทธิ์");
  });
  test("admin passes STAFF", async () => {
    const u = await makeUser({ role: "ADMIN" });
    await mockSession(u.id);
    await expect(requireRole("STAFF")).resolves.toMatchObject({ id: u.id, role: "ADMIN" });
  });
});
