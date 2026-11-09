import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import { parseDateOnly as d } from "@/lib/dates";
import { availableQuantity, capacity, reservedQuantity } from "@/server/loans/availability";
import { transition } from "@/server/loans/status";
import { makeItem, makeLoan, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

async function setup(total = 5) {
  const u = await makeUser();
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: total });
  return { u, item };
}
const S = d("2026-11-10");
const E = d("2026-11-12");

test("overlapping APPROVED/BORROWED reduce availability; PENDING/REJECTED don't", async () => {
  const { u, item } = await setup(10);
  const mk = (status: "APPROVED" | "BORROWED" | "PENDING" | "REJECTED") =>
    makeLoan({ borrowerId: u.id, status, startDate: S, dueDate: E, items: [{ itemId: item.id, quantity: 2 }] });
  await mk("APPROVED");
  await mk("BORROWED");
  await mk("PENDING");
  await mk("REJECTED");
  expect(await reservedQuantity(prisma, item.id, S, E)).toBe(4);
  expect(await availableQuantity(prisma, item.id, S, E)).toBe(6);
});

test("non-overlapping loan does not reduce availability", async () => {
  const { u, item } = await setup(5);
  await makeLoan({ borrowerId: u.id, status: "APPROVED", startDate: d("2026-11-13"), dueDate: d("2026-11-15"), items: [{ itemId: item.id, quantity: 3 }] });
  await makeLoan({ borrowerId: u.id, status: "APPROVED", startDate: d("2026-11-01"), dueDate: d("2026-11-09"), items: [{ itemId: item.id, quantity: 3 }] });
  expect(await availableQuantity(prisma, item.id, S, E)).toBe(5);
  // boundary: touching days overlap
  await makeLoan({ borrowerId: u.id, status: "APPROVED", startDate: E, dueDate: d("2026-11-14"), items: [{ itemId: item.id, quantity: 1 }] });
  expect(await availableQuantity(prisma, item.id, S, E)).toBe(4);
});

test("partial return frees quantity", async () => {
  const { u, item } = await setup(10);
  await makeLoan({ borrowerId: u.id, status: "BORROWED", startDate: S, dueDate: E, items: [{ itemId: item.id, quantity: 5, returnedQuantity: 3 }] });
  expect(await reservedQuantity(prisma, item.id, S, E)).toBe(2);
});

test("counts overdue unreturned loans regardless of dates", async () => {
  const { u, item } = await setup(2);
  await makeLoan({ borrowerId: u.id, status: "BORROWED", startDate: d("2026-11-01"), dueDate: d("2026-11-03"), items: [{ itemId: item.id, quantity: 2 }] });
  expect(await availableQuantity(prisma, item.id, d("2026-11-10"), d("2026-11-12"))).toBe(0);
});

test("APPROVED loan entirely in the past does not count", async () => {
  const { u, item } = await setup(2);
  await makeLoan({ borrowerId: u.id, status: "APPROVED", startDate: d("2026-11-01"), dueDate: d("2026-11-03"), items: [{ itemId: item.id, quantity: 2 }] });
  expect(await availableQuantity(prisma, item.id, S, E)).toBe(2);
});

describe("capacity", () => {
  test("REPAIR/LOST/RETIRED assets excluded", async () => {
    const item = await makeItem({ kind: "SERIALIZED", assets: ["A1", "A2", "A3", "A4", "A5"] });
    const st = ["AVAILABLE", "ON_LOAN", "REPAIR", "LOST", "RETIRED"] as const;
    for (let i = 0; i < 5; i++) await prisma.asset.update({ where: { id: item.assets[i].id }, data: { status: st[i] } });
    expect(await capacity(prisma, item.id)).toBe(2);
  });
  test("QUANTITY uses totalQuantity; inactive items are 0", async () => {
    const { item } = await setup(7);
    expect(await capacity(prisma, item.id)).toBe(7);
    await prisma.item.update({ where: { id: item.id }, data: { active: false } });
    expect(await capacity(prisma, item.id)).toBe(0);
  });
  test("inactive SERIALIZED item is 0", async () => {
    const item = await makeItem({ kind: "SERIALIZED", assets: ["B1"] });
    await prisma.item.update({ where: { id: item.id }, data: { active: false } });
    expect(await capacity(prisma, item.id)).toBe(0);
  });
  test("missing item is 0", async () => {
    expect(await capacity(prisma, "nope")).toBe(0);
  });
});

test("never negative", async () => {
  const { u, item } = await setup(5);
  await makeLoan({ borrowerId: u.id, status: "APPROVED", startDate: S, dueDate: E, items: [{ itemId: item.id, quantity: 5 }] });
  await prisma.item.update({ where: { id: item.id }, data: { totalQuantity: 4 } });
  expect(await availableQuantity(prisma, item.id, S, E)).toBe(0);
});

test("excludeLoanId ignores that loan", async () => {
  const { u, item } = await setup(5);
  const loan = await makeLoan({ borrowerId: u.id, status: "APPROVED", startDate: S, dueDate: E, items: [{ itemId: item.id, quantity: 5 }] });
  expect(await availableQuantity(prisma, item.id, S, E)).toBe(0);
  expect(await availableQuantity(prisma, item.id, S, E, loan.id)).toBe(5);
});

describe("transition", () => {
  test("updates when status matches", async () => {
    const { u } = await setup();
    const loan = await makeLoan({ borrowerId: u.id, status: "PENDING", startDate: S, dueDate: E, items: [] });
    await transition(prisma, loan.id, ["PENDING"], { status: "APPROVED" });
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).toBe("APPROVED");
  });
  test("fails when status already changed", async () => {
    const { u } = await setup();
    const loan = await makeLoan({ borrowerId: u.id, status: "APPROVED", startDate: S, dueDate: E, items: [] });
    await expect(transition(prisma, loan.id, ["PENDING"], { status: "REJECTED" })).rejects.toThrow("รายการนี้ถูกดำเนินการไปแล้ว");
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).toBe("APPROVED");
  });
  test("works inside a transaction client", async () => {
    const { u } = await setup();
    const loan = await makeLoan({ borrowerId: u.id, status: "PENDING", startDate: S, dueDate: E, items: [] });
    await prisma.$transaction((tx) => transition(tx, loan.id, ["PENDING", "APPROVED"], { status: "CANCELLED" }));
    expect((await prisma.loan.findUniqueOrThrow({ where: { id: loan.id } })).status).toBe("CANCELLED");
  });
});
