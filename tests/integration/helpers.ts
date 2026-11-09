import { vi } from "vitest";
import type { SessionUser } from "@/server/auth/session";
import { randomUUID } from "node:crypto";
import type { Asset, Item, ItemKind, Loan, LoanStatus, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertTestDatabaseUrl } from "./dbGuard";

export async function resetDb() {
  assertTestDatabaseUrl(process.env.DATABASE_URL);
  const rows = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const names = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}

export async function makeUser(o: Partial<User> = {}): Promise<User> {
  const id = randomUUID();
  return prisma.user.create({
    data: {
      name: "ผู้ใช้ทดสอบ",
      email: `${id}@example.com`,
      passwordHash: "x",
      department: "IT",
      phone: "0800000000",
      role: "BORROWER",
      status: "ACTIVE",
      ...o,
    },
  });
}

export async function makeItem(o: {
  kind: ItemKind;
  totalQuantity?: number;
  assets?: string[];
  maxLoanDays?: number;
}): Promise<Item & { assets: Asset[] }> {
  const category = await prisma.category.create({ data: { name: `cat-${randomUUID()}` } });
  return prisma.item.create({
    data: {
      name: `item-${randomUUID()}`,
      categoryId: category.id,
      kind: o.kind,
      totalQuantity: o.totalQuantity ?? 0,
      ...(o.maxLoanDays !== undefined ? { maxLoanDays: o.maxLoanDays } : {}),
      assets: { create: (o.assets ?? []).map((assetTag) => ({ assetTag })) },
    },
    include: { assets: true },
  });
}

export async function makeLoan(o: {
  borrowerId: string;
  status: LoanStatus;
  startDate: Date;
  dueDate: Date;
  items: { itemId: string; quantity: number; returnedQuantity?: number }[];
}): Promise<Loan> {
  return prisma.loan.create({
    data: {
      borrowerId: o.borrowerId,
      status: o.status,
      startDate: o.startDate,
      dueDate: o.dueDate,
      purpose: "ทดสอบ",
      items: {
        create: o.items.map((i) => ({
          itemId: i.itemId,
          quantity: i.quantity,
          returnedQuantity: i.returnedQuantity ?? 0,
        })),
      },
    },
  });
}

/**
 * Session mocking pattern: a test file that needs a logged-in user must declare
 *   vi.mock("@/auth", () => ({ auth: vi.fn() }));
 * (vi.mock is hoisted per file, so it cannot live in this helper). Then call
 * `await mockSession(userId)` to make `auth()` resolve to a session for that user,
 * or `await mockSession(null)` for no session.
 */
export async function mockSession(userId: string | null): Promise<void> {
  const { auth } = await import("@/auth"); // lazy: keeps next-auth out of tests that never mock a session
  vi.mocked(auth).mockResolvedValue(
    (userId ? { user: { id: userId }, expires: "2999-01-01T00:00:00.000Z" } : null) as never,
  );
}

export function asSession(u: User): SessionUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}
