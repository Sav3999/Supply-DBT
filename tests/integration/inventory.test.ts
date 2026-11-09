import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import { parseDateOnly as d } from "@/lib/dates";
import { createCategory, deleteCategory, renameCategory } from "@/server/inventory/categories";
import { createItem, getItem, listItems, setItemActive, setItemImage, updateItem } from "@/server/inventory/items";
import { addAsset, setAssetStatus } from "@/server/inventory/assets";
import { outstandingQuantity } from "@/server/loans/availability";
import { asSession, makeItem, makeLoan, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

const audits = (action: string) => prisma.auditLog.count({ where: { action } });

async function base() {
  const category = await prisma.category.create({ data: { name: "หมวด" } });
  return { name: "ของ", categoryId: category.id, kind: "QUANTITY" as const, totalQuantity: 10, maxLoanDays: 7 };
}

describe("categories", () => {
  test("admin creates, renames, deletes with audit", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const c = await createCategory(asSession(admin), "กล้อง");
    await renameCategory(asSession(admin), c.id, "กล้องถ่ายรูป");
    await deleteCategory(asSession(admin), c.id);
    expect(await prisma.category.count()).toBe(0);
    expect(await audits("CATEGORY_CREATE")).toBe(1);
    expect(await audits("CATEGORY_RENAME")).toBe(1);
    expect(await audits("CATEGORY_DELETE")).toBe(1);
  });

  test("staff cannot manage categories", async () => {
    const staff = await makeUser({ role: "STAFF" });
    await expect(createCategory(asSession(staff), "x")).rejects.toThrow("ไม่มีสิทธิ์");
  });

  test("cannot delete category with items", async () => {
    const admin = await makeUser({ role: "ADMIN" });
    const item = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
    await expect(deleteCategory(asSession(admin), item.categoryId)).rejects.toThrow(
      "ลบไม่ได้ เพราะยังมีของในหมวดนี้",
    );
  });
});

describe("items", () => {
  test("borrower cannot create item", async () => {
    const u = await makeUser();
    await expect(createItem(asSession(u), await base())).rejects.toThrow("ไม่มีสิทธิ์");
  });

  test("create serialized ignores totalQuantity; kind cannot change", async () => {
    const staff = await makeUser({ role: "STAFF" });
    const b = await base();
    const item = await createItem(asSession(staff), { ...b, kind: "SERIALIZED", totalQuantity: 9 });
    expect(item.totalQuantity).toBe(0);
    expect(await audits("ITEM_CREATE")).toBe(1);
    await expect(updateItem(asSession(staff), item.id, { ...b, kind: "QUANTITY" })).rejects.toThrow(
      "เปลี่ยนประเภทของไม่ได้",
    );
  });

  test("validates maxLoanDays", async () => {
    const staff = await makeUser({ role: "STAFF" });
    await expect(createItem(asSession(staff), { ...(await base()), maxLoanDays: 400 })).rejects.toThrow();
  });

  test("rejects totalQuantity below outstanding", async () => {
    const staff = await makeUser({ role: "STAFF" });
    const item = await makeItem({ kind: "QUANTITY", totalQuantity: 10 });
    await makeLoan({
      borrowerId: staff.id,
      status: "BORROWED",
      startDate: d("2026-11-09"),
      dueDate: d("2026-11-12"),
      items: [{ itemId: item.id, quantity: 6, returnedQuantity: 1 }],
    });
    expect(await outstandingQuantity(prisma, item.id)).toBe(5);
    const input = { name: item.name, categoryId: item.categoryId, kind: "QUANTITY" as const, totalQuantity: 4, maxLoanDays: 7 };
    await expect(updateItem(asSession(staff), item.id, input)).rejects.toThrow("จำนวนรวมน้อยกว่าจำนวนที่ถูกยืมอยู่");
    await expect(updateItem(asSession(staff), item.id, { ...input, totalQuantity: 5 })).resolves.toBeTruthy();
    expect(await audits("ITEM_UPDATE")).toBe(1);
  });

  test("list/get/active", async () => {
    const staff = await makeUser({ role: "STAFF" });
    const item = await makeItem({ kind: "QUANTITY", totalQuantity: 2 });
    await setItemActive(asSession(staff), item.id, false);
    expect(await listItems({})).toHaveLength(0);
    expect(await listItems({ includeInactive: true })).toHaveLength(1);
    expect(await listItems({ includeInactive: true, q: item.name.slice(0, 8) })).toHaveLength(1);
    expect((await getItem(item.id))?.id).toBe(item.id);
  });
});

describe("assets", () => {
  test("add asset, duplicate tag rejected", async () => {
    const staff = await makeUser({ role: "STAFF" });
    const item = await makeItem({ kind: "SERIALIZED" });
    await addAsset(asSession(staff), item.id, "A-001");
    await expect(addAsset(asSession(staff), item.id, "A-001")).rejects.toThrow("เลขครุภัณฑ์นี้มีอยู่แล้ว");
    expect(await audits("ASSET_ADD")).toBe(1);
  });

  test("asset only on SERIALIZED item", async () => {
    const staff = await makeUser({ role: "STAFF" });
    const item = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
    await expect(addAsset(asSession(staff), item.id, "A-1")).rejects.toThrow();
  });

  test("cannot change status of ON_LOAN asset", async () => {
    const staff = await makeUser({ role: "STAFF" });
    const item = await makeItem({ kind: "SERIALIZED", assets: ["B-1"] });
    const asset = item.assets[0];
    await prisma.asset.update({ where: { id: asset.id }, data: { status: "ON_LOAN" } });
    await expect(setAssetStatus(asSession(staff), asset.id, "REPAIR")).rejects.toThrow("เลขครุภัณฑ์นี้ถูกยืมอยู่");
  });

  test("changes status with audit", async () => {
    const staff = await makeUser({ role: "STAFF" });
    const item = await makeItem({ kind: "SERIALIZED", assets: ["C-1"] });
    await setAssetStatus(asSession(staff), item.assets[0].id, "REPAIR");
    expect((await prisma.asset.findUniqueOrThrow({ where: { id: item.assets[0].id } })).status).toBe("REPAIR");
    expect(await audits("ASSET_STATUS")).toBe(1);
  });
});

describe("image", () => {
  test("setItemImage stores filename and rejects bad type", async () => {
    process.env.UPLOAD_DIR = mkdtempSync(path.join(tmpdir(), "inv-img-"));
    const staff = await makeUser({ role: "STAFF" });
    const item = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
    await expect(
      setItemImage(asSession(staff), item.id, new File(["x"], "a.gif", { type: "image/gif" })),
    ).rejects.toThrow("รองรับเฉพาะไฟล์ jpg, png, webp");
    const updated = await setItemImage(
      asSession(staff),
      item.id,
      new File([new Uint8Array([1])], "a.png", { type: "image/png" }),
    );
    expect(updated.imagePath).toMatch(/^[0-9a-f-]{36}\.png$/);
  });
});
