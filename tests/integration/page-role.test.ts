import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { requirePageRole } from "@/server/auth/session";
import { makeUser, mockSession, resetDb } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const HOME = /^REDIRECT:\/$/;

beforeEach(async () => {
  await resetDb();
  await mockSession(null);
});

describe("requirePageRole", () => {
  test("no session redirects to /login", async () => {
    await expect(requirePageRole("STAFF")).rejects.toThrow("REDIRECT:/login");
  });
  test("suspended user with live session redirects to /logout", async () => {
    const u = await makeUser({ role: "STAFF", status: "SUSPENDED" });
    await mockSession(u.id);
    await expect(requirePageRole("STAFF")).rejects.toThrow("REDIRECT:/logout");
  });
  test("borrower on a staff page is redirected home", async () => {
    const u = await makeUser();
    await mockSession(u.id);
    await expect(requirePageRole("STAFF")).rejects.toThrow(HOME);
  });
  test("user promoted after login gets the user back (DB role, not JWT)", async () => {
    const u = await makeUser();
    await mockSession(u.id);
    await prisma.user.update({ where: { id: u.id }, data: { role: "STAFF" } });
    await expect(requirePageRole("STAFF")).resolves.toMatchObject({ id: u.id, role: "STAFF" });
  });
  test("demoted staff is redirected home instead of crashing", async () => {
    const u = await makeUser({ role: "STAFF" });
    await mockSession(u.id);
    await prisma.user.update({ where: { id: u.id }, data: { role: "BORROWER" } });
    await expect(requirePageRole("STAFF")).rejects.toThrow(HOME);
  });
  test("admin passes STAFF and ADMIN pages; staff is redirected from ADMIN", async () => {
    const a = await makeUser({ role: "ADMIN" });
    await mockSession(a.id);
    await expect(requirePageRole("STAFF")).resolves.toMatchObject({ role: "ADMIN" });
    await expect(requirePageRole("ADMIN")).resolves.toMatchObject({ role: "ADMIN" });
    const s = await makeUser({ role: "STAFF" });
    await mockSession(s.id);
    await expect(requirePageRole("ADMIN")).rejects.toThrow(HOME);
  });
});
