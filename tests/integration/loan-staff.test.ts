import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Item, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, todayBangkok } from "@/lib/dates";
import { setLoanEventHandler } from "@/server/loans/events";
import {
  approveLoan,
  getLoanForStaff,
  handOverLoan,
  listLoansForStaff,
  receiveReturn,
  rejectLoan,
} from "@/server/loans/staff";
import { asSession, makeItem, makeLoan, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);
afterEach(() => setLoanEventHandler(async () => {}));

const today = todayBangkok();
const START = addDays(today, 1);
const DUE = addDays(today, 3);

let borrower: User;
let staffUser: User;
const staff = () => asSession(staffUser);

beforeEach(async () => {
  borrower = await makeUser({ name: "สมชาย ใจดี" });
  staffUser = await makeUser({ role: "STAFF" });
});

const loanOf = (
  item: Item,
  quantity: number,
  status: "PENDING" | "APPROVED" | "BORROWED" = "PENDING",
  o: { startDate?: Date; dueDate?: Date; returnedQuantity?: number } = {},
) =>
  makeLoan({
    borrowerId: borrower.id,
    status,
    startDate: o.startDate ?? START,
    dueDate: o.dueDate ?? DUE,
    items: [{ itemId: item.id, quantity, returnedQuantity: o.returnedQuantity }],
  });
const pendingLoan = (item: Item, q: number) => loanOf(item, q);

async function loanItemOf(loanId: string) {
  return prisma.loanItem.findFirstOrThrow({ where: { loanId } });
}

/** สร้าง Loan BORROWED ของ SERIALIZED ผ่าน approve + handOver จริง */
async function borrowedSerialized(tags: string[], quantity: number) {
  const made = await makeItem({ kind: "SERIALIZED", assets: tags });
  const item = { ...made, assets: [...made.assets].sort((a, b) => a.assetTag.localeCompare(b.assetTag)) };
  const loan = await pendingLoan(item, quantity);
  await approveLoan(staff(), loan.id);
  const li = await loanItemOf(loan.id);
  const assets = item.assets.slice(0, quantity).map((a) => a.id);
  await handOverLoan(staff(), loan.id, { assets: { [li.id]: assets } });
  return { item, loan, li, assets };
}

// ---------- approve ----------

test("approve succeeds when available and sets approver", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 2 });
  const loan = await pendingLoan(item, 2);
  await approveLoan(staff(), loan.id);
  const after = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
  expect(after.status).toBe("APPROVED");
  expect(after.approverId).toBe(staffUser.id);
  expect(after.approvedAt).toBeInstanceOf(Date);
  expect(await prisma.auditLog.count({ where: { action: "LOAN_APPROVE", entityId: loan.id } })).toBe(1);
  // approving twice → already processed
  await expect(approveLoan(staff(), loan.id)).rejects.toThrow("รายการนี้ถูกดำเนินการไปแล้ว");
});

test("approve fails when stock taken by another approved loan", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 2 });
  await prisma.item.update({ where: { id: item.id }, data: { name: "โปรเจกเตอร์" } });
  await loanOf(item, 2, "APPROVED");
  const loan = await pendingLoan(item, 1);
  await expect(approveLoan(staff(), loan.id)).rejects.toThrow("ของไม่พอในช่วงวันที่เลือก: โปรเจกเตอร์");
  expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).toBe("PENDING");
});

test("approve fails when an overdue unreturned loan still holds the stock", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
  await loanOf(item, 1, "BORROWED", { startDate: addDays(today, -5), dueDate: addDays(today, -2) });
  const loan = await pendingLoan(item, 1);
  await expect(approveLoan(staff(), loan.id)).rejects.toThrow("ของไม่พอในช่วงวันที่เลือก");
});

test("concurrent approvals for last unit: exactly one succeeds", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
  const [a, b] = await Promise.all([pendingLoan(item, 1), pendingLoan(item, 1)]);
  const r = await Promise.allSettled([approveLoan(staff(), a.id), approveLoan(staff(), b.id)]);
  expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  const rejected = r.find((x): x is PromiseRejectedResult => x.status === "rejected")!;
  expect([`ของไม่พอในช่วงวันที่เลือก: ${item.name}`, "รายการนี้ถูกดำเนินการไปแล้ว"]).toContain(
    (rejected.reason as Error).message,
  );
  expect(await prisma.loan.count({ where: { status: "APPROVED" } })).toBe(1);
});

test("concurrent approvals of the same loan: exactly one succeeds", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 3 });
  const loan = await pendingLoan(item, 1);
  const r = await Promise.allSettled([approveLoan(staff(), loan.id), approveLoan(staff(), loan.id)]);
  expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  expect(await prisma.auditLog.count({ where: { action: "LOAN_APPROVE" } })).toBe(1);
});

// ---------- reject ----------

test("reject requires reason", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
  const loan = await pendingLoan(item, 1);
  await expect(rejectLoan(staff(), loan.id, "   ")).rejects.toThrow("กรุณาระบุเหตุผล");
  await rejectLoan(staff(), loan.id, "  ของต้องใช้ในงานอื่น ");
  const after = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
  expect(after.status).toBe("REJECTED");
  expect(after.rejectReason).toBe("ของต้องใช้ในงานอื่น");
  expect(await prisma.auditLog.count({ where: { action: "LOAN_REJECT", entityId: loan.id } })).toBe(1);
  await expect(rejectLoan(staff(), loan.id, "อีกครั้ง")).rejects.toThrow("รายการนี้ถูกดำเนินการไปแล้ว");
});

// ---------- handover ----------

test("handover assigns assets and marks ON_LOAN", async () => {
  const { loan, li, assets } = await borrowedSerialized(["A-1", "A-2", "A-3"], 2);
  const after = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
  expect(after.status).toBe("BORROWED");
  expect(after.handedOverAt).toBeInstanceOf(Date);
  const las = await prisma.loanAsset.findMany({ where: { loanItemId: li.id } });
  expect(las.map((x) => x.assetId).sort()).toEqual([...assets].sort());
  const statuses = await prisma.asset.findMany({ where: { id: { in: assets } } });
  expect(statuses.every((a) => a.status === "ON_LOAN")).toBe(true);
  expect(await prisma.asset.count({ where: { assetTag: "A-3", status: "AVAILABLE" } })).toBe(1);
  expect(await prisma.auditLog.count({ where: { action: "LOAN_HANDOVER", entityId: loan.id } })).toBe(1);
});

test("handover of QUANTITY loan needs no assets", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 3 });
  const loan = await loanOf(item, 2, "APPROVED");
  await handOverLoan(staff(), loan.id, { assets: {} });
  expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).toBe("BORROWED");
});

test("handover rejects asset already ON_LOAN", async () => {
  const item = await makeItem({ kind: "SERIALIZED", assets: ["B-1", "B-2"] });
  const loan = await loanOf(item, 1, "APPROVED");
  await prisma.asset.update({ where: { id: item.assets[0].id }, data: { status: "ON_LOAN" } });
  const li = await loanItemOf(loan.id);
  await expect(handOverLoan(staff(), loan.id, { assets: { [li.id]: [item.assets[0].id] } })).rejects.toThrow(
    "เลขครุภัณฑ์นี้ถูกยืมอยู่",
  );
  expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).toBe("APPROVED");
  expect(await prisma.loanAsset.count()).toBe(0);
});

test("handover rejects wrong asset count", async () => {
  const item = await makeItem({ kind: "SERIALIZED", assets: ["C-1", "C-2"] });
  const loan = await loanOf(item, 2, "APPROVED");
  const li = await loanItemOf(loan.id);
  await expect(handOverLoan(staff(), loan.id, { assets: { [li.id]: [item.assets[0].id] } })).rejects.toThrow(
    "กรุณาเลือกเลขครุภัณฑ์ให้ครบ",
  );
  // duplicates don't count twice
  await expect(
    handOverLoan(staff(), loan.id, { assets: { [li.id]: [item.assets[0].id, item.assets[0].id] } }),
  ).rejects.toThrow("กรุณาเลือกเลขครุภัณฑ์ให้ครบ");
  await expect(handOverLoan(staff(), loan.id, { assets: {} })).rejects.toThrow("กรุณาเลือกเลขครุภัณฑ์ให้ครบ");
  expect(await prisma.asset.count({ where: { status: "ON_LOAN" } })).toBe(0);
});

test("handover rejects asset of another item", async () => {
  const item = await makeItem({ kind: "SERIALIZED", assets: ["D-1"] });
  const other = await makeItem({ kind: "SERIALIZED", assets: ["E-1"] });
  const loan = await loanOf(item, 1, "APPROVED");
  const li = await loanItemOf(loan.id);
  await expect(handOverLoan(staff(), loan.id, { assets: { [li.id]: [other.assets[0].id] } })).rejects.toThrow();
  expect(await prisma.asset.count({ where: { status: "ON_LOAN" } })).toBe(0);
});

test("handover requires APPROVED", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
  const loan = await pendingLoan(item, 1);
  await expect(handOverLoan(staff(), loan.id, { assets: {} })).rejects.toThrow("รายการนี้ถูกดำเนินการไปแล้ว");
});

test("concurrent handovers of the same asset to two loans: exactly one succeeds", async () => {
  const item = await makeItem({ kind: "SERIALIZED", assets: ["F-1", "F-2"] });
  const a = await loanOf(item, 1, "APPROVED");
  const b = await loanOf(item, 1, "APPROVED");
  const [la, lb] = await Promise.all([loanItemOf(a.id), loanItemOf(b.id)]);
  const asset = item.assets[0].id;
  const r = await Promise.allSettled([
    handOverLoan(staff(), a.id, { assets: { [la.id]: [asset] } }),
    handOverLoan(staff(), b.id, { assets: { [lb.id]: [asset] } }),
  ]);
  expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  const rejected = r.find((x): x is PromiseRejectedResult => x.status === "rejected")!;
  expect((rejected.reason as Error).message).toBe("เลขครุภัณฑ์นี้ถูกยืมอยู่");
  expect(await prisma.loanAsset.count()).toBe(1);
});

// ---------- return ----------

test("partial return keeps BORROWED; full return sets RETURNED", async () => {
  const { item, loan, li, assets } = await borrowedSerialized(["G-1", "G-2"], 2);
  await receiveReturn(staff(), loan.id, {
    serialized: [{ loanItemId: li.id, assetId: assets[0], condition: "GOOD" }],
    quantity: [],
  });
  let after = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
  expect(after.status).toBe("BORROWED");
  expect(after.returnedAt).toBeNull();
  expect((await loanItemOf(loan.id)).returnedQuantity).toBe(1);
  expect((await prisma.asset.findUniqueOrThrow({ where: { id: assets[0] } })).status).toBe("AVAILABLE");
  const la = await prisma.loanAsset.findUniqueOrThrow({
    where: { loanItemId_assetId: { loanItemId: li.id, assetId: assets[0] } },
  });
  expect(la.returnedAt).toBeInstanceOf(Date);
  expect(la.condition).toBe("GOOD");

  await receiveReturn(staff(), loan.id, {
    serialized: [{ loanItemId: li.id, assetId: assets[1], condition: "LOST" }],
    quantity: [],
  });
  after = await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } });
  expect(after.status).toBe("RETURNED");
  expect(after.returnedAt).toBeInstanceOf(Date);
  expect((await prisma.asset.findUniqueOrThrow({ where: { id: assets[1] } })).status).toBe("LOST");
  expect(await prisma.auditLog.count({ where: { action: "LOAN_RETURN", entityId: loan.id } })).toBe(2);
  expect(item.id).toBeTruthy();

  // QUANTITY: partial then full
  const qItem = await makeItem({ kind: "QUANTITY", totalQuantity: 5 });
  const qLoan = await loanOf(qItem, 5, "BORROWED");
  const qli = await loanItemOf(qLoan.id);
  await receiveReturn(staff(), qLoan.id, { serialized: [], quantity: [{ loanItemId: qli.id, quantity: 2, condition: "GOOD" }] });
  expect((await prisma.loan.findUniqueOrThrow({ where: { id: qLoan.id } })).status).toBe("BORROWED");
  await receiveReturn(staff(), qLoan.id, { serialized: [], quantity: [{ loanItemId: qli.id, quantity: 3, condition: "DAMAGED" }] });
  expect((await prisma.loan.findUniqueOrThrow({ where: { id: qLoan.id } })).status).toBe("RETURNED");
  expect((await loanItemOf(qLoan.id)).returnedQuantity).toBe(5);
});

test("damaged return sets asset REPAIR", async () => {
  const { loan, li, assets } = await borrowedSerialized(["H-1"], 1);
  await receiveReturn(staff(), loan.id, {
    serialized: [{ loanItemId: li.id, assetId: assets[0], condition: "DAMAGED" }],
    quantity: [],
  });
  expect((await prisma.asset.findUniqueOrThrow({ where: { id: assets[0] } })).status).toBe("REPAIR");
  const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "LOAN_RETURN" } });
  expect(JSON.stringify(audit.data)).toContain("DAMAGED");
});

test("rejects returning more than outstanding", async () => {
  // QUANTITY ยืม 5 คืน 3 แล้ว → คืนอีก 3
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 5 });
  const loan = await loanOf(item, 5, "BORROWED", { returnedQuantity: 3 });
  const li = await loanItemOf(loan.id);
  await expect(
    receiveReturn(staff(), loan.id, { serialized: [], quantity: [{ loanItemId: li.id, quantity: 3, condition: "GOOD" }] }),
  ).rejects.toThrow("จำนวนคืนเกินจำนวนที่ค้าง");
  // split across two lines in one submit is also caught
  await expect(
    receiveReturn(staff(), loan.id, {
      serialized: [],
      quantity: [
        { loanItemId: li.id, quantity: 2, condition: "GOOD" },
        { loanItemId: li.id, quantity: 1, condition: "DAMAGED" },
      ],
    }),
  ).rejects.toThrow("จำนวนคืนเกินจำนวนที่ค้าง");
  expect((await loanItemOf(loan.id)).returnedQuantity).toBe(3);

  // double submit in parallel: only one may succeed, returnedQuantity never exceeds quantity
  const submit = () =>
    receiveReturn(staff(), loan.id, { serialized: [], quantity: [{ loanItemId: li.id, quantity: 2, condition: "GOOD" }] });
  const r = await Promise.allSettled([submit(), submit()]);
  expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  expect((await loanItemOf(loan.id)).returnedQuantity).toBe(5);

  // Asset ที่คืนแล้วคืนซ้ำ → "ชิ้นนี้คืนไปแล้ว"
  const s = await borrowedSerialized(["J-1", "J-2"], 2);
  const ret = () =>
    receiveReturn(staff(), s.loan.id, {
      serialized: [{ loanItemId: s.li.id, assetId: s.assets[0], condition: "GOOD" }],
      quantity: [],
    });
  await ret();
  await expect(ret()).rejects.toThrow("ชิ้นนี้คืนไปแล้ว");
  expect((await loanItemOf(s.loan.id)).returnedQuantity).toBe(1);
  // asset that was never on this loan
  const stranger = await makeItem({ kind: "SERIALIZED", assets: ["K-1"] });
  await expect(
    receiveReturn(staff(), s.loan.id, {
      serialized: [{ loanItemId: s.li.id, assetId: stranger.assets[0].id, condition: "GOOD" }],
      quantity: [],
    }),
  ).rejects.toThrow("ชิ้นนี้คืนไปแล้ว");
});

test("return requires BORROWED and at least one line", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 5 });
  const approved = await loanOf(item, 1, "APPROVED");
  const li = await loanItemOf(approved.id);
  await expect(
    receiveReturn(staff(), approved.id, { serialized: [], quantity: [{ loanItemId: li.id, quantity: 1, condition: "GOOD" }] }),
  ).rejects.toThrow("รายการนี้ถูกดำเนินการไปแล้ว");
  const borrowed = await loanOf(item, 1, "BORROWED");
  await expect(receiveReturn(staff(), borrowed.id, { serialized: [], quantity: [] })).rejects.toThrow(
    "กรุณาเลือกรายการที่คืน",
  );
});

// ---------- permissions ----------

test("borrower cannot approve", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
  const loan = await pendingLoan(item, 1);
  const b = asSession(borrower);
  await expect(approveLoan(b, loan.id)).rejects.toThrow("ไม่มีสิทธิ์");
  await expect(rejectLoan(b, loan.id, "x")).rejects.toThrow("ไม่มีสิทธิ์");
  await expect(handOverLoan(b, loan.id, { assets: {} })).rejects.toThrow("ไม่มีสิทธิ์");
  await expect(receiveReturn(b, loan.id, { serialized: [], quantity: [] })).rejects.toThrow("ไม่มีสิทธิ์");
  expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).toBe("PENDING");
  // ADMIN passes STAFF checks
  const admin = await makeUser({ role: "ADMIN" });
  await approveLoan(asSession(admin), loan.id);
});

// ---------- events ----------

test("each action fires loan event once", async () => {
  const spy = vi.fn(async () => {});
  setLoanEventHandler(spy);
  const events = () => spy.mock.calls.map((c) => (c as unknown[])[0]);

  const { loan, li, assets } = await borrowedSerialized(["L-1", "L-2"], 2);
  expect(events()).toEqual(["APPROVED", "HANDED_OVER"]);
  expect(spy).toHaveBeenLastCalledWith("HANDED_OVER", expect.objectContaining({ id: loan.id, status: "BORROWED" }));

  await receiveReturn(staff(), loan.id, {
    serialized: [{ loanItemId: li.id, assetId: assets[0], condition: "GOOD" }],
    quantity: [],
  });
  expect(events()).toEqual(["APPROVED", "HANDED_OVER"]); // partial → no event
  await receiveReturn(staff(), loan.id, {
    serialized: [{ loanItemId: li.id, assetId: assets[1], condition: "GOOD" }],
    quantity: [],
  });
  expect(events()).toEqual(["APPROVED", "HANDED_OVER", "RETURNED"]);

  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
  const p = await pendingLoan(item, 1);
  await rejectLoan(staff(), p.id, "ไม่ว่าง");
  expect(events()).toEqual(["APPROVED", "HANDED_OVER", "RETURNED", "REJECTED"]);
  expect(spy).toHaveBeenLastCalledWith("REJECTED", expect.objectContaining({ id: p.id, status: "REJECTED" }));

  // failed action → no event
  await expect(rejectLoan(staff(), p.id, "ซ้ำ")).rejects.toThrow();
  expect(spy).toHaveBeenCalledTimes(4);
});

// ---------- queries ----------

test("listLoansForStaff filters by status, OVERDUE and borrower name", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 10 });
  const other = await makeUser({ name: "วิภา รักงาน" });
  const pending = await pendingLoan(item, 1);
  const approved = await loanOf(item, 1, "APPROVED");
  const borrowedOk = await loanOf(item, 1, "BORROWED", { startDate: addDays(today, -1), dueDate: today });
  const overdue = await makeLoan({
    borrowerId: other.id,
    status: "BORROWED",
    startDate: addDays(today, -4),
    dueDate: addDays(today, -1),
    items: [{ itemId: item.id, quantity: 1 }],
  });
  const ids = (l: { id: string }[]) => l.map((x) => x.id).sort();

  expect(ids(await listLoansForStaff({ status: "PENDING" }))).toEqual([pending.id]);
  expect(ids(await listLoansForStaff({ status: "APPROVED" }))).toEqual([approved.id]);
  expect(ids(await listLoansForStaff({ status: "BORROWED" }))).toEqual([borrowedOk.id, overdue.id].sort());
  expect(ids(await listLoansForStaff({ status: "OVERDUE" }))).toEqual([overdue.id]);
  expect(await listLoansForStaff({})).toHaveLength(4);
  expect(ids(await listLoansForStaff({ q: "วิภา" }))).toEqual([overdue.id]);
  expect(ids(await listLoansForStaff({ status: "PENDING", q: "วิภา" }))).toEqual([]);
  const [row] = await listLoansForStaff({ status: "OVERDUE" });
  expect(row.borrower.name).toBe("วิภา รักงาน");
  expect(row.items[0].item.name).toBe(item.name);
});

test("getLoanForStaff includes borrower, available assets and assigned assets", async () => {
  const { loan, li, assets, item } = await borrowedSerialized(["M-1", "M-2", "M-3"], 1);
  await prisma.asset.update({ where: { id: item.assets[2].id }, data: { status: "REPAIR" } });
  const full = await getLoanForStaff(loan.id);
  expect(full.borrower.name).toBe("สมชาย ใจดี");
  const line = full.items.find((i) => i.id === li.id)!;
  expect(line.assets.map((a) => a.assetId)).toEqual(assets);
  expect(line.assets[0].asset.assetTag).toBe("M-1");
  expect(line.availableAssets.map((a) => a.assetTag)).toEqual(["M-2"]);
  await expect(getLoanForStaff("nope")).rejects.toThrow("ไม่พบคำขอ");
});

test("approve reports every short item in one error", async () => {
  const a = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
  const b = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
  await prisma.item.update({ where: { id: a.id }, data: { name: "สว่าน" } });
  await prisma.item.update({ where: { id: b.id }, data: { name: "บันได" } });
  await loanOf(a, 1, "APPROVED");
  await loanOf(b, 1, "APPROVED");
  const loan = await makeLoan({
    borrowerId: borrower.id,
    status: "PENDING",
    startDate: START,
    dueDate: DUE,
    items: [{ itemId: a.id, quantity: 1 }, { itemId: b.id, quantity: 1 }],
  });
  const err = await approveLoan(staff(), loan.id).catch((e: Error) => e);
  expect((err as Error).message).toMatch(/^ของไม่พอในช่วงวันที่เลือก: /);
  expect((err as Error).message).toContain("สว่าน");
  expect((err as Error).message).toContain("บันได");
});
