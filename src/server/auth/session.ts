import type { Role } from "@prisma/client";
import { AppError } from "@/lib/result";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export type SessionUser = { id: string; name: string; email: string; role: Role };

/** Pure role check. ADMIN passes every STAFF check. */
export function assertRole(user: SessionUser, ...roles: Role[]): void {
  const allowed = roles.includes(user.role) || (user.role === "ADMIN" && roles.includes("STAFF"));
  if (!allowed) throw new AppError("ไม่มีสิทธิ์");
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.status !== "ACTIVE") return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("ไม่มีสิทธิ์");
  assertRole(user, ...roles);
  return user;
}
