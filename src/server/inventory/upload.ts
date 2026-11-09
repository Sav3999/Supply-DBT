import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/result";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** บันทึกรูปลง UPLOAD_DIR ด้วยชื่อสุ่ม คืนชื่อไฟล์ `<uuid>.<ext>` */
export async function saveUpload(file: File): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) throw new AppError("รองรับเฉพาะไฟล์ jpg, png, webp");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError("ไฟล์ต้องไม่เกิน 5MB");
  const dir = getEnv().UPLOAD_DIR;
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return name;
}
