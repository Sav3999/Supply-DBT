import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import {
  activateUser,
  approveUser,
  listUsers,
  rejectUser,
  setRole,
  suspendUser,
} from "@/server/users";
import { asSession, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

const audits = (action: string, entityId: string) =>
  prisma.auditLog.count({ where: { action, entityId } });

describe("users admin", () => {
  test("approve pending user writes audit", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const p = await makeUser({ status: "PENDING" });
    await approveUser(asSession(admin), p.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("ACTIVE");
    expect(await audits("USER_APPROVE", p.id)).toBe(1);
  });

  test("approving twice fails", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const p = await makeUser({ status: "PENDING" });
    await approveUser(asSession(admin), p.id);
    await expect(approveUser(asSession(admin), p.id)).rejects.toThrow("รายการนี้ถูกดำเนินการไปแล้ว");
    expect(await audits("USER_APPROVE", p.id)).toBe(1);
  });

  test("reject deletes only pending", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const active = await makeUser();
    await expect(rejectUser(asSession(admin), active.id)).rejects.toThrow("รายการนี้ถูกดำเนินการไปแล้ว");
    expect(await prisma.user.findUnique({ where: { id: active.id } })).not.toBeNull();
    const p = await makeUser({ status: "PENDING" });
    await rejectUser(asSession(admin), p.id);
    expect(await prisma.user.findUnique({ where: { id: p.id } })).toBeNull();
    expect(await audits("USER_REJECT", p.id)).toBe(1);
  });

  test("staff and borrower cannot manage users", async () => {
    const staff = await makeUser({ role: "STAFF" });
    const borrower = await makeUser();
    const p = await makeUser({ status: "PENDING" });
    await expect(approveUser(asSession(staff), p.id)).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(rejectUser(asSession(borrower), p.id)).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(listUsers(asSession(staff), {})).rejects.toThrow("ไม่มีสิทธิ์");
    await expect(setRole(asSession(staff), p.id, "ADMIN")).rejects.toThrow("ไม่มีสิทธิ์");
  });

  test("admin cannot demote or suspend self", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const s = asSession(admin);
    await expect(setRole(s, admin.id, "BORROWER")).rejects.toThrow("ไม่สามารถแก้ไขบัญชีของตัวเองได้");
    await expect(suspendUser(s, admin.id)).rejects.toThrow("ไม่สามารถแก้ไขบัญชีของตัวเองได้");
    const after = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(after.role).toBe("ADMIN");
    expect(after.status).toBe("ACTIVE");
  });

  test("suspend and activate", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const u = await makeUser();
    await suspendUser(asSession(admin), u.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe("SUSPENDED");
    await expect(suspendUser(asSession(admin), u.id)).rejects.toThrow("รายการนี้ถูกดำเนินการไปแล้ว");
    await activateUser(asSession(admin), u.id);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe("ACTIVE");
    expect(await audits("USER_SUSPEND", u.id)).toBe(1);
    expect(await audits("USER_ACTIVATE", u.id)).toBe(1);
  });

  test("setRole changes role and audits", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const u = await makeUser();
    await setRole(asSession(admin), u.id, "STAFF");
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe("STAFF");
    expect(await audits("USER_SET_ROLE", u.id)).toBe(1);
  });

  test("listUsers filters by status and query", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    await makeUser({ status: "PENDING", name: "สมชาย" });
    await makeUser({ name: "สมหญิง" });
    const s = asSession(admin);
    expect((await listUsers(s, { status: "PENDING" })).map((u) => u.name)).toEqual(["สมชาย"]);
    expect((await listUsers(s, { q: "สมหญิง" })).map((u) => u.name)).toEqual(["สมหญิง"]);
    expect((await listUsers(s, {})).length).toBe(3);
  });
});
