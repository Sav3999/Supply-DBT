import { prisma } from "@/lib/db";
import { AppError } from "@/lib/result";
import { hashPassword, verifyPassword } from "./password";
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

// Constant cost-12 hash so unknown emails take about as long as known ones.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  return (dummyHash ??= hashPassword("dummy-password-for-timing"));
}

export async function authorizeCredentials(
  rawEmail: string,
  password: string,
  now: Date = new Date(),
): Promise<SessionUser> {
  const email = rawEmail.trim().toLowerCase();

  // Reserve the attempt synchronously (before any await) by counting it as a
  // failure up front, so parallel requests cannot all slip past the check.
  const recent = recentFailures(email, now);
  if (recent.length >= MAX_FAILURES) throw new AppError("ลองใหม่อีกครั้งใน 15 นาที");
  failures.set(email, [...recent, now.getTime()]);

  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user ? user.passwordHash : await getDummyHash());
  if (!user || !ok) throw new AppError("อีเมลหรือรหัสผ่านไม่ถูกต้อง"); // reservation stays = failure

  // Correct password: clear the history, even if the account is not active
  // (PENDING/SUSPENDED must not lock out faster than wrong passwords would).
  failures.delete(email);
  if (user.status === "PENDING") throw new AppError("รอแอดมินยืนยัน");
  if (user.status === "SUSPENDED") throw new AppError("บัญชีถูกระงับ");

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
