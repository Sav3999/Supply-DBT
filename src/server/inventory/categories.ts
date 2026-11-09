import { Prisma, type Category } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/result";
import { logAudit } from "@/server/audit";
import { assertRole, type SessionUser } from "@/server/auth/session";

function cleanName(name: string): string {
  const n = name.trim();
  if (!n) throw new AppError("กรุณากรอกชื่อหมวดหมู่");
  return n;
}

function isCode(e: unknown, code: string): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === code;
}

export async function listCategories(): Promise<(Category & { _count: { items: number } })[]> {
  return prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { items: true } } } });
}

export async function createCategory(actor: SessionUser, name: string): Promise<Category> {
  assertRole(actor, "ADMIN");
  const n = cleanName(name);
  try {
    return await prisma.$transaction(async (tx) => {
      const c = await tx.category.create({ data: { name: n } });
      await logAudit(tx, { actorId: actor.id, action: "CATEGORY_CREATE", entity: "Category", entityId: c.id, data: { name: n } });
      return c;
    });
  } catch (e) {
    if (isCode(e, "P2002")) throw new AppError("มีหมวดหมู่นี้อยู่แล้ว");
    throw e;
  }
}

export async function renameCategory(actor: SessionUser, id: string, name: string): Promise<Category> {
  assertRole(actor, "ADMIN");
  const n = cleanName(name);
  try {
    return await prisma.$transaction(async (tx) => {
      const old = await tx.category.findUnique({ where: { id } });
      if (!old) throw new AppError("ไม่พบหมวดหมู่");
      const c = await tx.category.update({ where: { id }, data: { name: n } });
      await logAudit(tx, { actorId: actor.id, action: "CATEGORY_RENAME", entity: "Category", entityId: id, data: { from: old.name, to: n } });
      return c;
    });
  } catch (e) {
    if (isCode(e, "P2002")) throw new AppError("มีหมวดหมู่นี้อยู่แล้ว");
    throw e;
  }
}

export async function deleteCategory(actor: SessionUser, id: string): Promise<void> {
  assertRole(actor, "ADMIN");
  const IN_USE = "ลบไม่ได้ เพราะยังมีของในหมวดนี้";
  try {
    await prisma.$transaction(async (tx) => {
      if ((await tx.item.count({ where: { categoryId: id } })) > 0) throw new AppError(IN_USE);
      const { count } = await tx.category.deleteMany({ where: { id } });
      if (count === 0) throw new AppError("ไม่พบหมวดหมู่");
      await logAudit(tx, { actorId: actor.id, action: "CATEGORY_DELETE", entity: "Category", entityId: id });
    });
  } catch (e) {
    // an item inserted concurrently trips the FK
    if (isCode(e, "P2003")) throw new AppError(IN_USE);
    throw e;
  }
}
