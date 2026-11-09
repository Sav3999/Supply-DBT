import type { Prisma, Role, User, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/result";
import { logAudit } from "@/server/audit";
import { assertRole, type SessionUser } from "@/server/auth/session";

const DONE = "รายการนี้ถูกดำเนินการไปแล้ว";
const SELF = "ไม่สามารถแก้ไขบัญชีของตัวเองได้";

function guardSelf(actor: SessionUser, userId: string) {
  if (actor.id === userId) throw new AppError(SELF);
}

export async function listUsers(
  actor: SessionUser,
  filter: { status?: UserStatus; q?: string },
): Promise<User[]> {
  assertRole(actor, "ADMIN");
  const q = filter.q?.trim();
  const where: Prisma.UserWhereInput = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { department: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return prisma.user.findMany({ where, orderBy: { createdAt: "desc" } });
}

async function transition(
  actor: SessionUser,
  userId: string,
  from: UserStatus,
  to: UserStatus,
  action: string,
) {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId, status: from },
      data: { status: to },
    });
    if (count === 0) throw new AppError(DONE);
    await logAudit(tx, { actorId: actor.id, action, entity: "User", entityId: userId });
  });
}

export async function approveUser(actor: SessionUser, userId: string): Promise<void> {
  assertRole(actor, "ADMIN");
  await transition(actor, userId, "PENDING", "ACTIVE", "USER_APPROVE");
}

export async function rejectUser(actor: SessionUser, userId: string): Promise<void> {
  assertRole(actor, "ADMIN");
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.user.deleteMany({ where: { id: userId, status: "PENDING" } });
    if (count === 0) throw new AppError(DONE);
    await logAudit(tx, { actorId: actor.id, action: "USER_REJECT", entity: "User", entityId: userId });
  });
}

export async function suspendUser(actor: SessionUser, userId: string): Promise<void> {
  assertRole(actor, "ADMIN");
  guardSelf(actor, userId);
  await transition(actor, userId, "ACTIVE", "SUSPENDED", "USER_SUSPEND");
}

export async function activateUser(actor: SessionUser, userId: string): Promise<void> {
  assertRole(actor, "ADMIN");
  guardSelf(actor, userId);
  await transition(actor, userId, "SUSPENDED", "ACTIVE", "USER_ACTIVATE");
}

export async function setRole(actor: SessionUser, userId: string, role: Role): Promise<void> {
  assertRole(actor, "ADMIN");
  guardSelf(actor, userId);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("ไม่พบผู้ใช้");
    await tx.user.update({ where: { id: userId }, data: { role } });
    await logAudit(tx, {
      actorId: actor.id,
      action: "USER_SET_ROLE",
      entity: "User",
      entityId: userId,
      data: { from: user.role, to: role },
    });
  });
}
