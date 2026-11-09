import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createLoan } from "@/server/loans/request";
import { approveLoan, rejectLoan } from "@/server/loans/staff";
import { registerUser } from "@/server/auth/register";
import { FakeLineClient, NoopLineClient, setLineClient } from "@/server/line/client";
import { listNotifications, markAllRead, notify, notifyRoles, unreadCount } from "@/server/notifications";
import { ensureWired } from "@/server/wiring";
import { asSession, makeItem, makeUser, resetDb } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

let fake: FakeLineClient;
beforeEach(async () => {
  await resetDb();
  ensureWired();
  fake = new FakeLineClient();
  setLineClient(fake);
});
afterEach(() => setLineClient(new NoopLineClient()));

describe("notify", () => {
  test("stores row and pushes only linked users", async () => {
    const linked = await makeUser({ lineUserId: "Uline1" });
    const plain = await makeUser();
    await notify([linked.id, plain.id, linked.id], "hello", "/x");
    expect(await unreadCount(linked.id)).toBe(1);
    expect(await unreadCount(plain.id)).toBe(1);
    expect(fake.pushed).toEqual([{ to: "Uline1", text: "hello" }]);
  });

  test("empty list is a no-op", async () => {
    await expect(notify([], "x")).resolves.toBeUndefined();
    expect(await prisma.notification.count()).toBe(0);
  });

  test("LINE failure does not throw", async () => {
    const linked = await makeUser({ lineUserId: "Uline1" });
    setLineClient({ enabled: true, push: async () => { throw new Error("down"); }, reply: async () => {} });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(notify([linked.id], "x")).resolves.toBeUndefined();
    expect(await unreadCount(linked.id)).toBe(1);
  });

  test("markAllRead", async () => {
    const u = await makeUser();
    await notify([u.id], "a");
    await notify([u.id], "b");
    expect(await unreadCount(u.id)).toBe(2);
    await markAllRead(u.id);
    expect(await unreadCount(u.id)).toBe(0);
    expect(await listNotifications(u.id)).toHaveLength(2);
  });

  test("notifyRoles targets only active users in roles", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    await makeUser({ role: "ADMIN", status: "SUSPENDED" });
    await makeUser({ role: "BORROWER" });
    await notifyRoles(["ADMIN"], "m");
    expect(await prisma.notification.count()).toBe(1);
    expect(await unreadCount(admin.id)).toBe(1);
  });
});

describe("wiring", () => {
  test("new registration notifies admins", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    await registerUser({ name: "สมชาย", email: "a@b.co", password: "password1", department: "บัญชี", phone: "081" });
    const [n] = await listNotifications(admin.id);
    expect(n.message).toBe("มีผู้สมัครใหม่: สมชาย (บัญชี)");
    expect(n.link).toBe("/admin/users");
  });

  test("create, approve and reject notify the right people", async () => {
    const borrower = await makeUser({ name: "บี" });
    const staff = await makeUser({ role: "STAFF" });
    const item = await makeItem({ kind: "QUANTITY", totalQuantity: 5 });
    const NOW = new Date("2026-11-09T05:00:00Z");
    const mk = () =>
      createLoan(
        asSession(borrower),
        { startDate: "2026-11-10", dueDate: "2026-11-12", purpose: "x", items: [{ itemId: item.id, quantity: 1 }] },
        NOW,
      );
    const loan = await mk();
    const [created] = await listNotifications(staff.id);
    expect(created.message).toBe("คำขอยืมใหม่จาก บี (1 รายการ)");
    expect(created.link).toBe(`/staff/loans/${loan.id}`);

    const linkedB = await prisma.user.update({ where: { id: borrower.id }, data: { lineUserId: "Ub" } });
    await approveLoan(asSession(staff), loan.id);
    const [approved] = await listNotifications(linkedB.id);
    expect(approved.message).toMatch(/^คำขอยืมได้รับอนุมัติ มารับของได้ตั้งแต่ .*พ\.ย\./);
    expect(approved.link).toBe(`/my-loans/${loan.id}`);
    expect(fake.pushed.map((p) => p.to)).toEqual(["Ub"]);

    const loan2 = await mk();
    await rejectLoan(asSession(staff), loan2.id, "ไม่ว่าง");
    const msgs = (await listNotifications(borrower.id)).map((n) => n.message);
    expect(msgs).toContain("คำขอยืมถูกปฏิเสธ: ไม่ว่าง");
  });
});
