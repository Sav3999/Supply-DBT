import { beforeEach, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { parseDateOnly as d } from "@/lib/dates";
import { cancelLoan, createLoan, getLoanForUser, listMyLoans } from "@/server/loans/request";
import { asSession, makeItem, makeLoan, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

const NOW = new Date("2026-11-09T05:00:00Z"); // 12:00 Bangkok, 2026-11-09

async function setup(total = 2) {
  const u = await makeUser();
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: total });
  return { u, item };
}
const input = (itemId: string, quantity = 1, extra: object = {}) => ({
  startDate: "2026-11-10",
  dueDate: "2026-11-12",
  purpose: "ใช้งานทดสอบ",
  items: [{ itemId, quantity }],
  ...extra,
});

test("creates PENDING loan with items", async () => {
  const { u, item } = await setup();
  const loan = await createLoan(asSession(u), input(item.id, 2), NOW);
  expect(loan.status).toBe("PENDING");
  expect(loan.borrowerId).toBe(u.id);
  const items = await prisma.loanItem.findMany({ where: { loanId: loan.id } });
  expect(items).toHaveLength(1);
  expect(items[0].quantity).toBe(2);
  expect(await prisma.auditLog.count({ where: { action: "LOAN_CREATE", entityId: loan.id } })).toBe(1);
});

test("rejects when not enough available", async () => {
  const { u, item } = await setup(2);
  await prisma.item.update({ where: { id: item.id }, data: { name: "จอบ" } });
  await expect(createLoan(asSession(u), input(item.id, 3), NOW)).rejects.toThrow(
    "ของไม่พอในช่วงวันที่เลือก: จอบ",
  );
  expect(await prisma.loan.count()).toBe(0);
});

test("accounts for approved loans in the same period", async () => {
  const { u, item } = await setup(2);
  await makeLoan({
    borrowerId: u.id,
    status: "APPROVED",
    startDate: d("2026-11-11"),
    dueDate: d("2026-11-11"),
    items: [{ itemId: item.id, quantity: 2 }],
  });
  await expect(createLoan(asSession(u), input(item.id, 1), NOW)).rejects.toThrow("ของไม่พอในช่วงวันที่เลือก");
});

test("rejects inactive item", async () => {
  const { u, item } = await setup();
  await prisma.item.update({ where: { id: item.id }, data: { active: false } });
  await expect(createLoan(asSession(u), input(item.id), NOW)).rejects.toThrow();
  expect(await prisma.loan.count()).toBe(0);
});

test("rejects start before today in Bangkok", async () => {
  const { u, item } = await setup();
  const late = new Date("2026-11-09T17:30:00Z"); // 00:30 on the 10th in Bangkok
  await expect(
    createLoan(asSession(u), input(item.id, 1, { startDate: "2026-11-09" }), late),
  ).rejects.toThrow("วันยืมต้องไม่ก่อนวันนี้");
});

test("rejects bad input (duplicate items, empty purpose)", async () => {
  const { u, item } = await setup();
  await expect(
    createLoan(asSession(u), input(item.id, 1, { items: [{ itemId: item.id, quantity: 1 }, { itemId: item.id, quantity: 1 }] }), NOW),
  ).rejects.toThrow();
  await expect(createLoan(asSession(u), input(item.id, 1, { purpose: "" }), NOW)).rejects.toThrow();
});

test("respects maxLoanDays", async () => {
  const { u, item } = await setup();
  await prisma.item.update({ where: { id: item.id }, data: { maxLoanDays: 2 } });
  await expect(createLoan(asSession(u), input(item.id), NOW)).rejects.toThrow("ยืมได้ไม่เกิน 2 วัน");
});

test("borrower cancels own PENDING; cannot cancel other's; cannot cancel BORROWED", async () => {
  const { u, item } = await setup();
  const other = await makeUser();
  const loan = await createLoan(asSession(u), input(item.id), NOW);
  await expect(cancelLoan(asSession(other), loan.id)).rejects.toThrow("ไม่มีสิทธิ์");
  await cancelLoan(asSession(u), loan.id);
  expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).toBe("CANCELLED");
  expect(await prisma.auditLog.count({ where: { action: "LOAN_CANCEL" } })).toBe(1);
  await expect(cancelLoan(asSession(u), loan.id)).rejects.toThrow("รายการนี้ถูกดำเนินการไปแล้ว");

  const borrowed = await makeLoan({
    borrowerId: u.id,
    status: "BORROWED",
    startDate: d("2026-11-10"),
    dueDate: d("2026-11-12"),
    items: [{ itemId: item.id, quantity: 1 }],
  });
  await expect(cancelLoan(asSession(u), borrowed.id)).rejects.toThrow("รายการนี้ถูกดำเนินการไปแล้ว");
});

test("borrower may cancel APPROVED; staff may cancel APPROVED but not PENDING", async () => {
  const { u, item } = await setup();
  const staff = await makeUser({ role: "STAFF" });
  const mk = (status: "PENDING" | "APPROVED") =>
    makeLoan({ borrowerId: u.id, status, startDate: d("2026-11-10"), dueDate: d("2026-11-12"), items: [{ itemId: item.id, quantity: 1 }] });
  const approved = await mk("APPROVED");
  const pending = await mk("PENDING");
  await expect(cancelLoan(asSession(staff), pending.id)).rejects.toThrow("ไม่มีสิทธิ์");
  await cancelLoan(asSession(staff), approved.id);
  const approved2 = await mk("APPROVED");
  await cancelLoan(asSession(u), approved2.id);
});

test("borrower cannot read other's loan; staff can; listMyLoans is own only", async () => {
  const { u, item } = await setup();
  const other = await makeUser();
  const staff = await makeUser({ role: "STAFF" });
  const loan = await createLoan(asSession(u), input(item.id), NOW);
  await expect(getLoanForUser(asSession(other), loan.id)).rejects.toThrow("ไม่มีสิทธิ์");
  expect((await getLoanForUser(asSession(staff), loan.id)).id).toBe(loan.id);
  expect((await getLoanForUser(asSession(u), loan.id)).items).toHaveLength(1);
  expect(await listMyLoans(asSession(other))).toHaveLength(0);
  expect(await listMyLoans(asSession(u))).toHaveLength(1);
});

test("emits CREATED after commit and survives handler failure", async () => {
  const { setLoanEventHandler } = await import("@/server/loans/events");
  const { u, item } = await setup();
  const fn = vi.fn().mockRejectedValue(new Error("boom"));
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  setLoanEventHandler(fn);
  const loan = await createLoan(asSession(u), input(item.id), NOW);
  expect(fn).toHaveBeenCalledWith("CREATED", expect.objectContaining({ id: loan.id }));
  spy.mockRestore();
  setLoanEventHandler(async () => {});
});

test("reports every short item in one error", async () => {
  const u = await makeUser();
  const a = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
  const b = await makeItem({ kind: "QUANTITY", totalQuantity: 5 });
  const c = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
  await prisma.item.update({ where: { id: a.id }, data: { name: "จอบ" } });
  await prisma.item.update({ where: { id: c.id }, data: { name: "เสียม" } });
  const req = { ...input(a.id), items: [{ itemId: a.id, quantity: 2 }, { itemId: b.id, quantity: 1 }, { itemId: c.id, quantity: 3 }] };
  const err = await createLoan(asSession(u), req, NOW).catch((e: Error) => e);
  expect((err as Error).message).toMatch(/^ของไม่พอในช่วงวันที่เลือก: /);
  expect((err as Error).message).toContain("จอบ");
  expect((err as Error).message).toContain("เสียม");
  expect(await prisma.loan.count()).toBe(0);
});
