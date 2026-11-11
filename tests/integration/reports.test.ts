import { beforeEach, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { addDays, todayBangkok } from "@/lib/dates";
import { dashboardCounts, listAudit, searchHistory, historyToCsv } from "@/server/reports";
import { logAudit } from "@/server/audit";
import { makeItem, makeLoan, makeUser, mockSession, resetDb } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

beforeEach(resetDb);

const today = todayBangkok();

test("dashboardCounts", async () => {
  const u = await makeUser();
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 50 });
  const mk = (status: "PENDING" | "APPROVED" | "BORROWED" | "RETURNED", s: number, d: number) =>
    makeLoan({ borrowerId: u.id, status, startDate: addDays(today, s), dueDate: addDays(today, d), items: [{ itemId: item.id, quantity: 1 }] });
  await mk("PENDING", 1, 2);
  await mk("PENDING", 1, 2);
  await mk("APPROVED", 0, 2); // to hand over
  await mk("APPROVED", -1, 2); // to hand over (late)
  await mk("APPROVED", 1, 2); // not yet
  await mk("BORROWED", -2, 0); // due today
  await mk("BORROWED", -5, -1); // overdue
  await mk("BORROWED", -5, 3); // neither
  await mk("RETURNED", -5, -1); // ignored
  expect(await dashboardCounts(today)).toEqual({ pending: 2, toHandOverToday: 2, dueToday: 1, overdue: 1 });
});

test("searchHistory filters by borrower and date range, builds items string", async () => {
  const a = await makeUser({ name: "สมชาย ใจดี", department: "ฝ่ายA" });
  const b = await makeUser({ name: "มานี มีตา" });
  const nb = await makeItem({ kind: "SERIALIZED", assets: ["NB-1", "NB-2"] });
  const hoe = await makeItem({ kind: "QUANTITY", totalQuantity: 10 });
  const la = await makeLoan({
    borrowerId: a.id, status: "BORROWED", startDate: addDays(today, -3), dueDate: addDays(today, 1),
    items: [{ itemId: nb.id, quantity: 2 }, { itemId: hoe.id, quantity: 3 }],
  });
  const li = await prisma.loanItem.findFirstOrThrow({ where: { loanId: la.id, itemId: nb.id } });
  for (const asset of nb.assets) await prisma.loanAsset.create({ data: { loanItemId: li.id, assetId: asset.id } });
  await makeLoan({ borrowerId: b.id, status: "PENDING", startDate: addDays(today, 5), dueDate: addDays(today, 6), items: [{ itemId: hoe.id, quantity: 1 }] });

  const all = await searchHistory({});
  expect(all).toHaveLength(2);

  const byName = await searchHistory({ borrowerQ: "สมชาย" });
  expect(byName).toHaveLength(1);
  expect(byName[0].department).toBe("ฝ่ายA");
  expect(byName[0].items).toBe(`${nb.name} (NB-1, NB-2), ${hoe.name} x3`);

  expect(await searchHistory({ from: addDays(today, 4) })).toHaveLength(1);
  expect(await searchHistory({ to: addDays(today, 0) })).toHaveLength(1);
  expect(await searchHistory({ itemId: nb.id })).toHaveLength(1);
  expect(await searchHistory({ status: "PENDING" })).toHaveLength(1);
  expect(historyToCsv(all).split("\r\n").length).toBe(4);
});

test("listAudit filters by action, newest first", async () => {
  const u = await makeUser();
  await logAudit(prisma, { actorId: u.id, action: "A", entity: "Loan", entityId: "1" });
  await logAudit(prisma, { actorId: u.id, action: "B", entity: "Loan", entityId: "2" });
  const rows = await listAudit({});
  expect(rows.map((r) => r.action)).toEqual(["B", "A"]);
  expect(rows[0].actorName).toBe(u.name);
  expect((await listAudit({ action: "A" })).map((r) => r.entityId)).toEqual(["1"]);
});

test("csv route requires STAFF", async () => {
  const { GET } = await import("@/app/api/staff/history.csv/route");
  const req = () => new Request("http://localhost/api/staff/history.csv?borrower=x");

  await mockSession(null);
  expect((await GET(req())).status).toBe(401);

  const borrower = await makeUser();
  await mockSession(borrower.id);
  expect((await GET(req())).status).toBe(403);

  const staff = await makeUser({ role: "STAFF", name: "ผู้ใช้" });
  await mockSession(staff.id);
  const res = await GET(new Request("http://localhost/api/staff/history.csv"));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
  expect(res.headers.get("content-disposition")).toBe(`attachment; filename="history-${today.toISOString().slice(0, 10)}.csv"`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
});
