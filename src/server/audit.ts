import type { Prisma } from "@prisma/client";
import type { Db } from "@/lib/db";

export async function logAudit(
  db: Db,
  e: { actorId: string; action: string; entity: string; entityId: string; data?: unknown },
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: e.actorId,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      ...(e.data !== undefined ? { data: e.data as Prisma.InputJsonValue } : {}),
    },
  });
}
