import { randomInt } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getLineClient } from "@/server/line/client";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export const MSG_LINKED = "ผูกบัญชีสำเร็จ";
export const MSG_BAD_CODE = "รหัสไม่ถูกต้องหรือหมดอายุ";
export const MSG_INSTRUCTION = "พิมพ์รหัส 6 หลักจากหน้าโปรไฟล์บนเว็บเพื่อผูกบัญชี";

export type LineEvent = {
  type: string;
  replyToken?: string;
  source: { userId: string };
  message?: { type: string; text?: string };
};

export async function createLinkCode(
  userId: string,
  now: Date = new Date(),
): Promise<{ code: string; expiresAt: Date }> {
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    try {
      await prisma.$transaction(async (tx) => {
        await tx.lineLinkCode.deleteMany({ where: { OR: [{ userId }, { expiresAt: { lte: now } }] } });
        await tx.lineLinkCode.create({ data: { code, userId, expiresAt } });
      });
      return { code, expiresAt };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  throw new Error("สร้างรหัสไม่สำเร็จ กรุณาลองใหม่");
}

export async function unlinkLine(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { lineUserId: null } });
}

async function tryLink(code: string, lineUserId: string, now: Date): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.lineLinkCode.findUnique({ where: { code } });
    if (!row || row.expiresAt <= now) return false;
    // ลบก่อนเพื่อกันใช้รหัสซ้ำพร้อมกัน
    const { count } = await tx.lineLinkCode.deleteMany({ where: { code } });
    if (count === 0) return false;
    await tx.user.updateMany({
      where: { lineUserId, NOT: { id: row.userId } },
      data: { lineUserId: null },
    });
    await tx.user.update({ where: { id: row.userId }, data: { lineUserId } });
    return true;
  });
}

export async function handleLineEvent(event: LineEvent, now: Date = new Date()): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  const reply = async (text: string) => {
    if (event.replyToken) await getLineClient().reply(event.replyToken, text);
  };

  if (event.type === "unfollow") {
    await prisma.user.updateMany({ where: { lineUserId }, data: { lineUserId: null } });
    return;
  }
  if (event.type === "follow") {
    await reply(MSG_INSTRUCTION);
    return;
  }
  if (event.type !== "message") return;

  const text = event.message?.type === "text" ? (event.message.text ?? "").trim() : undefined;
  if (text !== undefined && /^\d{6}$/.test(text)) {
    const ok = await tryLink(text, lineUserId, now);
    await reply(ok ? MSG_LINKED : MSG_BAD_CODE);
    return;
  }
  await reply(MSG_INSTRUCTION);
}
