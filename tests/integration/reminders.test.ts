import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import { runReminders } from "@/server/reminders";
import { POST } from "@/app/api/cron/reminders/route";
import { NoopLineClient, setLineClient } from "@/server/line/client";
import { makeItem, makeLoan, makeUser, resetDb } from "./helpers";

const at = (iso: string) => new Date(iso);
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

beforeEach(async () => {
  await resetDb();
  setLineClient(new NoopLineClient());
});

async function seed() {
  const borrower = await makeUser();
  const staff = await makeUser({ role: "STAFF" });
  const admin = await makeUser({ role: "ADMIN" });
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 5 });
  const mk = (status: "BORROWED" | "RETURNED" | "APPROVED", dueDate: string) =>
    makeLoan({ borrowerId: borrower.id, status, startDate: d("2026-11-01"), dueDate: d(dueDate), items: [{ itemId: item.id, quantity: 1 }] });
  return { borrower, staff, admin, mk };
}

describe("runReminders", () => {
  test("skips before 08:00 Bangkok", async () => {
    const { mk } = await seed();
    await mk("BORROWED", "2026-11-10");
    const r = await runReminders(at("2026-11-09T00:30:00Z"));
    expect(r).toEqual({ skipped: true, dueTomorrow: 0, overdue: 0, digest: false });
    expect(await prisma.notification.count()).toBe(0);
  });

  test("sends due-tomorrow and overdue once per day", async () => {
    const { borrower, staff, admin, mk } = await seed();
    await mk("BORROWED", "2026-11-10");
    await mk("BORROWED", "2026-11-07");
    const r1 = await runReminders(at("2026-11-09T01:05:00Z"));
    expect(r1).toMatchObject({ skipped: false, dueTomorrow: 1, overdue: 1, digest: true });
    const msgs = (await prisma.notification.findMany({ where: { userId: borrower.id } })).map((n) => n.message);
    expect(msgs).toContain("เกินกำหนดคืนแล้ว 2 วัน กรุณาคืนของโดยเร็ว");
    expect(msgs.some((m) => m.startsWith("พรุ่งนี้ (") && m.endsWith(") ครบกำหนดคืนของ"))).toBe(true);
    for (const u of [staff, admin]) {
      const n = await prisma.notification.findFirstOrThrow({ where: { userId: u.id } });
      expect(n.message).toBe("วันนี้มีรายการเกินกำหนด 1 รายการ");
      expect(n.link).toBe("/staff/loans?status=OVERDUE");
    }
    const r2 = await runReminders(at("2026-11-09T02:05:00Z"));
    expect(r2).toMatchObject({ dueTomorrow: 0, overdue: 0, digest: false });
    const r3 = await runReminders(at("2026-11-10T01:05:00Z"));
    expect(r3.overdue).toBe(1);
    expect(r3.digest).toBe(true);
  });

  test("ignores RETURNED and APPROVED loans", async () => {
    const { mk } = await seed();
    await mk("RETURNED", "2026-11-07");
    await mk("APPROVED", "2026-11-10");
    const r = await runReminders(at("2026-11-09T01:05:00Z"));
    expect(r).toMatchObject({ dueTomorrow: 0, overdue: 0, digest: false });
    expect(await prisma.notification.count()).toBe(0);
  });

  test("uses Bangkok day near midnight", async () => {
    const { mk } = await seed();
    await mk("BORROWED", "2026-11-10");
    // 2026-11-09T17:30Z = 2026-11-10 00:30 Bangkok -> before 08:00, skipped
    expect((await runReminders(at("2026-11-09T17:30:00Z"))).skipped).toBe(true);
    // 2026-11-10T01:00Z = 08:00 Bangkok on the 10th -> due today, not tomorrow, not overdue
    const r = await runReminders(at("2026-11-10T01:00:00Z"));
    expect(r).toMatchObject({ dueTomorrow: 0, overdue: 0 });
  });
});

describe("POST /api/cron/reminders", () => {
  const original = process.env.CRON_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });
  const req = (auth?: string) =>
    new Request("http://localhost/api/cron/reminders", { method: "POST", headers: auth ? { authorization: auth } : {} });

  test("rejects missing secret header", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await POST(req())).status).toBe(401);
    expect((await POST(req("Bearer wrong!"))).status).toBe(401);
    expect((await POST(req("Bearer s3cre"))).status).toBe(401);
  });

  test("rejects everything when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    expect((await POST(req("Bearer "))).status).toBe(401);
    expect((await POST(req("Bearer undefined"))).status).toBe(401);
  });

  test("runs with correct secret", async () => {
    process.env.CRON_SECRET = "s3cret";
    const res = await POST(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("skipped");
    expect(body).toHaveProperty("dueTomorrow");
  });
});
