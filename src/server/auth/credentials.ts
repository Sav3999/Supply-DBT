import { prisma } from "@/lib/db";
import { AppError } from "@/lib/result";
import { verifyPassword } from "./password";
import type { SessionUser } from "./session";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;

// In-memory: the app runs as a single instance.
const failures = new Map<string, number[]>();

export function resetLoginLimiter(): void {
  failures.clear();
}

function recentFailures(email: string, now: Date): number[] {
  const cutoff = now.getTime() - WINDOW_MS;
  const recent = (failures.get(email) ?? []).filter((t) => t > cutoff);
  if (recent.length) failures.set(email, recent);
  else failures.delete(email);
  return recent;
}

export async function authorizeCredentials(
  rawEmail: string,
  password: string,
  now: Date = new Date(),
): Promise<SessionUser> {
  const email = rawEmail.trim().toLowerCase();
  if (recentFailures(email, now).length >= MAX_FAILURES) {
    throw new AppError("ลองใหม่อีกครั้งใน 15 นาที");
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    failures.set(email, [...recentFailures(email, now), now.getTime()]);
    throw new AppError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }
  if (user.status === "PENDING") throw new AppError("รอแอดมินยืนยัน");
  if (user.status === "SUSPENDED") throw new AppError("บัญชีถูกระงับ");

  failures.delete(email);
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
