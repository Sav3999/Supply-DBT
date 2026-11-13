import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addDays, bangkokHour, formatThaiDate, todayBangkok } from "@/lib/dates";
import { notify, notifyRoles } from "@/server/notifications";

export type ReminderResult = { skipped: boolean; dueTomorrow: number; overdue: number; digest: boolean };

const DAY_MS = 86_400_000;

/** จองสิทธิ์ส่งด้วย ReminderLog; คืน false ถ้าเคยส่งไปแล้ววันนี้ (P2002) */
async function claim(loanId: string, type: string, date: Date): Promise<boolean> {
  try {
    await prisma.reminderLog.create({ data: { loanId, type, date } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

export async function runReminders(now: Date): Promise<ReminderResult> {
  if (bangkokHour(now) < 8) return { skipped: true, dueTomorrow: 0, overdue: 0, digest: false };
  const today = todayBangkok(now);
  const tomorrow = addDays(today, 1);

  const dueLoans = await prisma.loan.findMany({
    where: { status: "BORROWED", dueDate: tomorrow, borrower: { status: "ACTIVE" } },
    select: { id: true, borrowerId: true, dueDate: true },
  });
  let dueTomorrow = 0;
  for (const loan of dueLoans) {
    if (!(await claim(loan.id, "DUE_TOMORROW", today))) continue;
    await notify([loan.borrowerId], `พรุ่งนี้ (${formatThaiDate(loan.dueDate)}) ครบกำหนดคืนของ`, `/my-loans/${loan.id}`);
    dueTomorrow++;
  }

  const overdueLoans = await prisma.loan.findMany({
    where: { status: "BORROWED", dueDate: { lt: today } },
    select: { id: true, borrowerId: true, dueDate: true, borrower: { select: { status: true } } },
  });
  let overdue = 0;
  for (const loan of overdueLoans) {
    // suspended borrowers get no reminders (staff digest still counts their loans)
    if (loan.borrower.status !== "ACTIVE") continue;
    if (!(await claim(loan.id, "OVERDUE", today))) continue;
    const days = Math.round((today.getTime() - loan.dueDate.getTime()) / DAY_MS);
    await notify([loan.borrowerId], `เกินกำหนดคืนแล้ว ${days} วัน กรุณาคืนของโดยเร็ว`, `/my-loans/${loan.id}`);
    overdue++;
  }

  let digest = false;
  if (overdueLoans.length >= 1 && (await claim("STAFF_DIGEST", "OVERDUE_DIGEST", today))) {
    await notifyRoles(["STAFF", "ADMIN"], `วันนี้มีรายการเกินกำหนด ${overdueLoans.length} รายการ`, "/staff/loans?status=OVERDUE");
    digest = true;
  }

  return { skipped: false, dueTomorrow, overdue, digest };
}
