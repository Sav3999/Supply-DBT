import type { Role } from "@prisma/client";
import { AppError } from "@/lib/result";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";

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

/**
 * Page-level guard for server components. Roles come from the DB (never the
 * JWT, which is only refreshed at sign-in), so a role change takes effect
 * immediately without redirect loops or crashes:
 * - no session → /login
 * - session for a missing/non-ACTIVE user → /logout (clears the stale JWT)
 * - wrong role → / (which routes by the DB role)
 */
export async function requirePageRole(...roles: Role[]): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await getCurrentUser();
  if (!user) redirect("/logout");
  try {
    assertRole(user, ...roles);
  } catch {
    redirect("/");
  }
  return user;
}
