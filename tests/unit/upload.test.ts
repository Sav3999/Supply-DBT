import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { saveUpload } from "@/server/inventory/upload";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "upload-test-"));
  process.env.UPLOAD_DIR = dir;
  process.env.DATABASE_URL ??= "postgresql://x";
  process.env.AUTH_SECRET ??= "x";
});

describe("saveUpload", () => {
  test("rejects gif and >5MB", async () => {
    await expect(saveUpload(new File(["x"], "a.gif", { type: "image/gif" }))).rejects.toThrow(
      "รองรับเฉพาะไฟล์ jpg, png, webp",
    );
    await expect(
      saveUpload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "a.png", { type: "image/png" })),
    ).rejects.toThrow("ไฟล์ต้องไม่เกิน 5MB");
  });

  test("saves png with random uuid name", async () => {
    const name = await saveUpload(new File([new Uint8Array([1, 2, 3])], "photo.PNG", { type: "image/png" }));
    expect(name).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(existsSync(path.join(dir, name))).toBe(true);
  });
});
