import { Prisma, type Asset, type AssetStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/result";
import { logAudit } from "@/server/audit";
import { assertRole, type SessionUser } from "@/server/auth/session";

const STATUSES: AssetStatus[] = ["AVAILABLE", "REPAIR", "LOST", "RETIRED"];

export async function addAsset(actor: SessionUser, itemId: string, assetTag: string): Promise<Asset> {
  assertRole(actor, "STAFF");
  const tag = assetTag.trim();
  if (!tag) throw new AppError("กรุณากรอกเลขครุภัณฑ์");
  try {
    return await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id: itemId } });
      if (!item) throw new AppError("ไม่พบของ");
      if (item.kind !== "SERIALIZED") throw new AppError("เพิ่มเลขครุภัณฑ์ได้เฉพาะของแบบมีเลขครุภัณฑ์");
      const asset = await tx.asset.create({ data: { itemId, assetTag: tag } });
      await logAudit(tx, { actorId: actor.id, action: "ASSET_ADD", entity: "Asset", entityId: asset.id, data: { itemId, assetTag: tag } });
      return asset;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError("เลขครุภัณฑ์นี้มีอยู่แล้ว");
    }
    throw e;
  }
}

export async function setAssetStatus(actor: SessionUser, assetId: string, status: AssetStatus): Promise<void> {
  assertRole(actor, "STAFF");
  if (!STATUSES.includes(status)) throw new AppError("สถานะไม่ถูกต้อง");
  await prisma.$transaction(async (tx) => {
    const asset = await tx.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new AppError("ไม่พบเลขครุภัณฑ์");
    const { count } = await tx.asset.updateMany({
      where: { id: assetId, status: { not: "ON_LOAN" } },
      data: { status },
    });
    if (count === 0) throw new AppError("เลขครุภัณฑ์นี้ถูกยืมอยู่");
    await logAudit(tx, { actorId: actor.id, action: "ASSET_STATUS", entity: "Asset", entityId: assetId, data: { from: asset.status, to: status } });
  });
}
