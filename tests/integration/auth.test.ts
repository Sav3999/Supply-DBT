import { beforeEach, expect, test, vi } from "vitest";
import { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { logAudit } from "@/server/audit";
import { registerUser, setUserRegisteredHandler } from "@/server/auth/register";
import { authorizeCredentials, resetLoginLimiter } from "@/server/auth/credentials";
import { resetDb } from "./helpers";

const input = { name: "ก", email: "a@x.th", password: "12345678", department: "IT", phone: "0800000000" };

beforeEach(async () => {
  await resetDb();
  resetLoginLimiter();
  setUserRegisteredHandler(async () => {});
});

test("register creates PENDING borrower and rejects duplicate", async () => {
  const u = await registerUser(input);
  expect(u).toMatchObject({ status: "PENDING", role: "BORROWER" });
  expect(u.passwordHash).not.toBe(input.password);
  await expect(registerUser({ ...input })).rejects.toThrow("อีเมลนี้ถูกใช้แล้ว");
});

test("register rejects short password", async () => {
  await expect(registerUser({ ...input, password: "1234567" })).rejects.toBeInstanceOf(ZodError);
});

test("register calls the registered hook with the new user", async () => {
  const fn = vi.fn(async () => {});
  setUserRegisteredHandler(fn);
  const u = await registerUser(input);
  expect(fn).toHaveBeenCalledWith(expect.objectContaining({ id: u.id }));
});

test("hook failure does not fail registration", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  setUserRegisteredHandler(async () => { throw new Error("boom"); });
  await expect(registerUser(input)).resolves.toMatchObject({ email: "a@x.th" });
  expect(spy).toHaveBeenCalled();
  spy.mockRestore();
});

test("pending user cannot log in", async () => {
  await registerUser(input);
  await expect(authorizeCredentials("a@x.th", "12345678")).rejects.toThrow("รอแอดมินยืนยัน");
});

test("suspended user cannot log in", async () => {
  await registerUser(input);
  await prisma.user.update({ where: { email: "a@x.th" }, data: { status: "SUSPENDED" } });
  await expect(authorizeCredentials("a@x.th", "12345678")).rejects.toThrow("บัญชีถูกระงับ");
});

test("wrong password and unknown email give the same message", async () => {
  await registerUser(input);
  await prisma.user.update({ where: { email: "a@x.th" }, data: { status: "ACTIVE" } });
  await expect(authorizeCredentials("a@x.th", "bad")).rejects.toThrow("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  await expect(authorizeCredentials("no@x.th", "bad")).rejects.toThrow("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
});

test("active user logs in and gets SessionUser", async () => {
  const u = await registerUser(input);
  await prisma.user.update({ where: { id: u.id }, data: { status: "ACTIVE" } });
  expect(await authorizeCredentials("A@X.th", "12345678")).toEqual({
    id: u.id, name: "ก", email: "a@x.th", role: "BORROWER",
  });
});

test("rate limit after 5 failures in 15 minutes", async () => {
  const u = await registerUser(input);
  await prisma.user.update({ where: { id: u.id }, data: { status: "ACTIVE" } });
  const t0 = new Date("2026-11-09T03:00:00Z");
  for (let i = 0; i < 5; i++) await expect(authorizeCredentials("a@x.th", "bad", t0)).rejects.toThrow();
  await expect(authorizeCredentials("a@x.th", "12345678", t0)).rejects.toThrow("ลองใหม่อีกครั้งใน 15 นาที");
  expect(await authorizeCredentials("a@x.th", "12345678", new Date(t0.getTime() + 15 * 60_000 + 1))).toMatchObject({ email: "a@x.th" });
});

test("successful login clears failure history", async () => {
  const u = await registerUser(input);
  await prisma.user.update({ where: { id: u.id }, data: { status: "ACTIVE" } });
  const t0 = new Date("2026-11-09T03:00:00Z");
  for (let i = 0; i < 4; i++) await expect(authorizeCredentials("a@x.th", "bad", t0)).rejects.toThrow();
  await authorizeCredentials("a@x.th", "12345678", t0);
  for (let i = 0; i < 4; i++) await expect(authorizeCredentials("a@x.th", "bad", t0)).rejects.toThrow("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
});

test("logAudit writes a row, also inside a transaction", async () => {
  await logAudit(prisma, { actorId: "u1", action: "x", entity: "User", entityId: "e1", data: { a: 1 } });
  await prisma.$transaction((tx) => logAudit(tx, { actorId: "u1", action: "y", entity: "User", entityId: "e2" }));
  const rows = await prisma.auditLog.findMany({ orderBy: { action: "asc" } });
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({ action: "x", entityId: "e1", data: { a: 1 } });
});

test("parallel wrong-password attempts cannot bypass the rate limit", async () => {
  const u = await registerUser(input);
  await prisma.user.update({ where: { id: u.id }, data: { status: "ACTIVE" } });
  const t0 = new Date("2026-11-09T03:00:00Z");
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => authorizeCredentials("a@x.th", "bad", t0)),
  );
  expect(results.every((r) => r.status === "rejected")).toBe(true);
  await expect(authorizeCredentials("a@x.th", "12345678", t0)).rejects.toThrow("ลองใหม่อีกครั้งใน 15 นาที");
});
