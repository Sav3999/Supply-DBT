import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getLineClient } from "@/server/line/client";

/** บันทึกแจ้งเตือนในเว็บ แล้วส่ง LINE (ถ้าผูกบัญชี); ความล้มเหลวของ LINE ไม่ throw */
export async function notify(userIds: number[], message: string, link?: string): Promise<void> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, message, link: link ?? null })),
  });
  try {
    const line = getLineClient();
    if (!line.enabled) return;
    const users = await prisma.user.findMany({
      where: { id: { in: ids }, lineUserId: { not: null } },
      select: { lineUserId: true },
    });
    const results = await Promise.allSettled(users.map((u) => line.push(u.lineUserId!, message)));
    for (const r of results) {
      if (r.status === "rejected") console.error("LINE push failed", r.reason);
    }
  } catch (e) {
    console.error("LINE notify failed", e);
  }
}

export async function notifyRoles(roles: Role[], message: string, link?: string): Promise<void> {
  const users = await prisma.user.findMany({
    where: { role: { in: roles }, status: "ACTIVE" },
    select: { id: true },
  });
  await notify(
    users.map((u) => u.id),
    message,
    link,
  );
}

export function listNotifications(userId: number, take = 50) {
  return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}

export function unreadCount(userId: number): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markAllRead(userId: number): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}
