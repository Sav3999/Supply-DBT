import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/result";
import { logAudit } from "@/server/audit";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import type { SessionUser } from "@/server/auth/session";

const profileSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  department: z.string().trim().min(1, "กรุณากรอกหน่วยงาน"),
  phone: z.string().trim().min(1, "กรุณากรอกเบอร์โทร"),
});

const passwordSchema = z.object({
  current: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
  next: z.string().min(8, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"),
});

export async function updateProfile(actor: SessionUser, input: unknown): Promise<void> {
  const data = profileSchema.parse(input);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data });
    await logAudit(tx, { actorId: actor.id, action: "USER_UPDATE_PROFILE", entity: "User", entityId: actor.id });
  });
}

export async function changePassword(actor: SessionUser, input: unknown): Promise<void> {
  const { current, next } = passwordSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) throw new AppError("ไม่พบผู้ใช้");
  if (!(await verifyPassword(current, user.passwordHash))) throw new AppError("รหัสผ่านปัจจุบันไม่ถูกต้อง");
  const passwordHash = await hashPassword(next);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: actor.id }, data: { passwordHash } });
    await logAudit(tx, { actorId: actor.id, action: "USER_CHANGE_PASSWORD", entity: "User", entityId: actor.id });
  });
}
