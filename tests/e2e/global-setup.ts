import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { seed } from "../../prisma/seed";
import { hashPassword } from "../../src/server/auth/password";
import { assertTestDatabaseUrl } from "../integration/dbGuard";
import { ADMIN, STAFF } from "./accounts";

export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  assertTestDatabaseUrl(url); // refuse before touching anything

  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });

  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const rows = await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    if (rows.length > 0) {
      const names = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
      await db.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
    }

    await seed(db, { SEED_ADMIN_EMAIL: ADMIN.email, SEED_ADMIN_PASSWORD: ADMIN.password });

    await db.user.create({
      data: {
        email: STAFF.email,
        passwordHash: await hashPassword(STAFF.password),
        name: "เจ้าหน้าที่ทดสอบ",
        department: "คลัง",
        phone: "0811111111",
        role: "STAFF",
        status: "ACTIVE",
      },
    });

    const category = await db.category.findFirstOrThrow({ where: { name: "IT" } });
    await db.item.create({
      data: {
        name: "โน้ตบุ๊ก",
        categoryId: category.id,
        kind: "SERIALIZED",
        assets: { create: [{ assetTag: "NB-0012" }] },
      },
    });
    await db.item.create({
      data: { name: "จอบ", categoryId: category.id, kind: "QUANTITY", totalQuantity: 10 },
    });
  } finally {
    await db.$disconnect();
  }
}
