import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/server/auth/password";
import { seed } from "../../prisma/seed";
import { resetDb } from "./helpers";

beforeEach(resetDb);

const env = { SEED_ADMIN_EMAIL: "admin@example.com", SEED_ADMIN_PASSWORD: "password-1234" };

describe("seed", () => {
  test("seed is idempotent", async () => {
    await seed(prisma, env);
    await seed(prisma, env);
    expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
    expect(await prisma.category.count()).toBe(3);
    const names = (await prisma.category.findMany()).map((c) => c.name).sort();
    expect(names).toEqual(["IT", "การเกษตร", "ของใช้ทั่วไป"].sort());
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: env.SEED_ADMIN_EMAIL } });
    expect(admin).toMatchObject({
      role: "ADMIN",
      status: "ACTIVE",
      name: "ผู้ดูแลระบบ",
      department: "-",
      phone: "-",
    });
    expect(await verifyPassword(env.SEED_ADMIN_PASSWORD, admin.passwordHash)).toBe(true);
  });

  test("does not overwrite an existing admin's password but restores role/status", async () => {
    await seed(prisma, env);
    const before = await prisma.user.findUniqueOrThrow({ where: { email: env.SEED_ADMIN_EMAIL } });
    await prisma.user.update({
      where: { id: before.id },
      data: { role: "BORROWER", status: "SUSPENDED" },
    });
    await seed(prisma, { ...env, SEED_ADMIN_PASSWORD: "another-password" });
    const after = await prisma.user.findUniqueOrThrow({ where: { email: env.SEED_ADMIN_EMAIL } });
    expect(after.passwordHash).toBe(before.passwordHash);
    expect(after.role).toBe("ADMIN");
    expect(after.status).toBe("ACTIVE");
  });

  test("rejects a short password with a Thai error and creates nothing", async () => {
    await expect(seed(prisma, { ...env, SEED_ADMIN_PASSWORD: "short" })).rejects.toThrow(
      "SEED_ADMIN_PASSWORD ต้องยาวอย่างน้อย 8 ตัวอักษร",
    );
    expect(await prisma.user.count()).toBe(0);
  });
});
