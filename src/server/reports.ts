import type { LoanStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { LOAN_STATUS_LABEL } from "@/lib/labels";
import { formatDateOnly, parseDateOnly, todayBangkok } from "@/lib/dates";

// ---------- dashboard ----------

export async function dashboardCounts(today: Date) {
  const [pending, toHandOverToday, dueToday, overdue] = await Promise.all([
    prisma.loan.count({ where: { status: "PENDING" } }),
    prisma.loan.count({ where: { status: "APPROVED", startDate: { lte: today } } }),
    prisma.loan.count({ where: { status: "BORROWED", dueDate: today } }),
    prisma.loan.count({ where: { status: "BORROWED", dueDate: { lt: today } } }),
  ]);
  return { pending, toHandOverToday, dueToday, overdue };
}

// ---------- history ----------

export type HistoryFilter = { borrowerQ?: string; itemId?: string; from?: Date; to?: Date; status?: LoanStatus };

export type HistoryRow = {
  loanId: string;
  borrowerName: string;
  department: string;
  items: string;
  startDate: Date;
  dueDate: Date;
  status: LoanStatus;
  returnedAt: Date | null;
};

const STATUSES = Object.keys(LOAN_STATUS_LABEL) as LoanStatus[];

function validDate(s: string | undefined): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = parseDateOnly(s);
  return Number.isNaN(d.getTime()) || formatDateOnly(d) !== s ? undefined : d;
}

export function parseHistoryFilter(params: URLSearchParams | Record<string, string | undefined>): HistoryFilter {
  const get = (k: string): string | undefined =>
    (params instanceof URLSearchParams ? params.get(k) : params[k]) ?? undefined;
  const borrower = get("borrower")?.trim();
  const itemId = get("itemId")?.trim();
  const status = get("status");
  return {
    borrowerQ: borrower || undefined,
    itemId: itemId || undefined,
    from: validDate(get("from")),
    to: validDate(get("to")),
    status: STATUSES.find((s) => s === status),
  };
}

export async function searchHistory(filter: HistoryFilter, take = 200): Promise<HistoryRow[]> {
  const where: Prisma.LoanWhereInput = {};
  if (filter.borrowerQ) where.borrower = { name: { contains: filter.borrowerQ, mode: "insensitive" } };
  if (filter.itemId) where.items = { some: { itemId: filter.itemId } };
  if (filter.status) where.status = filter.status;
  if (filter.from || filter.to) {
    where.startDate = { ...(filter.from ? { gte: filter.from } : {}), ...(filter.to ? { lte: filter.to } : {}) };
  }
  const loans = await prisma.loan.findMany({
    where,
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      borrower: { select: { name: true, department: true } },
      items: {
        orderBy: { id: "asc" },
        include: { item: true, assets: { include: { asset: true }, orderBy: { asset: { assetTag: "asc" } } } },
      },
    },
  });
  return loans.map((l) => ({
    loanId: l.id,
    borrowerName: l.borrower.name,
    department: l.borrower.department,
    items: l.items
      .map((li) => {
        if (li.item.kind === "QUANTITY") return `${li.item.name} x${li.quantity}`;
        const tags = li.assets.map((a) => a.asset.assetTag);
        return tags.length ? `${li.item.name} (${tags.join(", ")})` : li.item.name;
      })
      .join(", "),
    startDate: l.startDate,
    dueDate: l.dueDate,
    status: l.status,
    returnedAt: l.returnedAt,
  }));
}

const CSV_HEADER = ["เลขที่", "ผู้ยืม", "หน่วยงาน", "รายการ", "วันยืม", "กำหนดคืน", "สถานะ", "วันที่คืน"];

/** ข้อความอิสระ: กัน formula injection ใน Excel ด้วย ' นำหน้าค่าที่ขึ้นต้นด้วย = + - @ tab CR (แล้วจึง quote ตาม RFC 4180) */
function csvText(v: string): string {
  return csvCell(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
}

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function historyToCsv(rows: HistoryRow[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.loanId,
        r.borrowerName,
        r.department,
        r.items,
      ].map((v, i) => (i === 0 ? csvCell(v) : csvText(v))).join(",") +
        "," +
        [
          formatDateOnly(r.startDate),
          formatDateOnly(r.dueDate),
          LOAN_STATUS_LABEL[r.status],
          r.returnedAt ? formatDateOnly(todayBangkok(r.returnedAt)) : "",
        ]
          .map(csvCell)
          .join(","),
    );
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

// ---------- audit ----------

export async function listAudit(filter: { action?: string; take?: number } = {}) {
  const logs = await prisma.auditLog.findMany({
    where: filter.action ? { action: filter.action } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: filter.take ?? 200,
  });
  const ids = [...new Set(logs.map((l) => l.actorId))];
  const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return logs.map((l) => ({ ...l, actorName: names.get(l.actorId) ?? null }));
}
