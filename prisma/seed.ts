import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/server/auth/password";

const CATEGORIES = ["IT", "การเกษตร", "ของใช้ทั่วไป"];

export async function seed(
  db: PrismaClient,
  env: { SEED_ADMIN_EMAIL: string; SEED_ADMIN_PASSWORD: string },
): Promise<void> {
  const email = env.SEED_ADMIN_EMAIL?.trim();
  if (!email) throw new Error("ต้องกำหนด SEED_ADMIN_EMAIL");
  if (!env.SEED_ADMIN_PASSWORD || env.SEED_ADMIN_PASSWORD.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD ต้องยาวอย่างน้อย 8 ตัวอักษร");
  }

  // ถ้ามีบัญชีอยู่แล้ว ไม่แตะรหัสผ่าน (กันเขียนทับรหัสที่แอดมินเปลี่ยนไปแล้ว) แค่ให้แน่ใจว่าเป็น ADMIN/ACTIVE
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN" || existing.status !== "ACTIVE") {
      await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN", status: "ACTIVE" } });
    }
  } else {
    await db.user.create({
      data: {
        email,
        passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
        name: "ผู้ดูแลระบบ",
        department: "-",
        phone: "-",
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  }

  for (const name of CATEGORIES) {
    await db.category.upsert({ where: { name }, update: {}, create: { name } });
  }
}

// รันเฉพาะเมื่อสั่งตรง ๆ (tsx prisma/seed.ts หรือ node seed.cjs) ไม่รันตอน import จากเทสต์
if (/[\/]seed\.(ts|cjs|js|mjs)$/.test(process.argv[1] ?? "")) {
  const db = new PrismaClient();
  seed(db, {
    SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL ?? "",
    SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD ?? "",
  })
    .then(() => console.log("seed เสร็จสิ้น"))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
