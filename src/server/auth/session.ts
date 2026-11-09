import type { Role } from "@prisma/client";
import { AppError } from "@/lib/result";

export type SessionUser = { id: string; name: string; email: string; role: Role };

/** Pure role check. ADMIN passes every STAFF check. */
export function assertRole(user: SessionUser, ...roles: Role[]): void {
  const allowed = roles.includes(user.role) || (user.role === "ADMIN" && roles.includes("STAFF"));
  if (!allowed) throw new AppError("ไม่มีสิทธิ์");
}
