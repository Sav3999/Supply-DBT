import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { FakeLineClient, NoopLineClient, setLineClient } from "@/server/line/client";
import { createLinkCode, handleLineEvent, unlinkLine } from "@/server/line/link";
import { changePassword, updateProfile } from "@/server/profile";
import { hashPassword } from "@/server/auth/password";
import { POST } from "@/app/api/line/webhook/route";
import { asSession, makeUser, resetDb } from "./helpers";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

let fake: FakeLineClient;
beforeEach(async () => {
  await resetDb();
  fake = new FakeLineClient();
  setLineClient(fake);
});
afterEach(() => setLineClient(new NoopLineClient()));

const textEvent = (userId: string, text: string) => ({
  type: "message",
  replyToken: "rt",
  source: { userId },
  message: { type: "text", text },
});
const getUser = (id: string) => prisma.user.findUniqueOrThrow({ where: { id } });

describe("createLinkCode", () => {
  test("makes a 6-digit code expiring in 10 minutes and replaces the old one", async () => {
    const u = await makeUser();
    const now = new Date("2026-11-09T03:00:00Z");
    const a = await createLinkCode(u.id, now);
    expect(a.code).toMatch(/^\d{6}$/);
    expect(a.expiresAt.toISOString()).toBe("2026-11-09T03:10:00.000Z");
    const b = await createLinkCode(u.id, now);
    const rows = await prisma.lineLinkCode.findMany({ where: { userId: u.id } });
    expect(rows.map((r) => r.code)).toEqual([b.code]);
  });
});

describe("handleLineEvent", () => {
  test("valid code links account and replies success", async () => {
    const u = await makeUser();
    const { code } = await createLinkCode(u.id);
    await handleLineEvent(textEvent("U1", code));
    expect((await getUser(u.id)).lineUserId).toBe("U1");
    expect(fake.replied.at(-1)?.text).toBe("ผูกบัญชีสำเร็จ");
    expect(await prisma.lineLinkCode.count()).toBe(0);
  });

  test("rejects expired and reused code", async () => {
    const u = await makeUser();
    const { code } = await createLinkCode(u.id, new Date("2026-11-09T03:00:00Z"));
    await handleLineEvent(textEvent("U1", code), new Date("2026-11-09T03:10:01Z"));
    expect(fake.replied.at(-1)?.text).toBe("รหัสไม่ถูกต้องหรือหมดอายุ");
    const fresh = await createLinkCode(u.id);
    await handleLineEvent(textEvent("U1", fresh.code));
    await handleLineEvent(textEvent("U2", fresh.code));
    expect(fake.replied.at(-1)?.text).toBe("รหัสไม่ถูกต้องหรือหมดอายุ");
    expect((await getUser(u.id)).lineUserId).toBe("U1");
  });

  test("moves a LINE id from another account", async () => {
    const old = await makeUser({ lineUserId: "U1" });
    const u = await makeUser();
    const { code } = await createLinkCode(u.id);
    await handleLineEvent(textEvent("U1", code));
    expect((await getUser(old.id)).lineUserId).toBeNull();
    expect((await getUser(u.id)).lineUserId).toBe("U1");
  });

  test("other text and follow get the instruction", async () => {
    const msg = "พิมพ์รหัส 6 หลักจากหน้าโปรไฟล์บนเว็บเพื่อผูกบัญชี";
    await handleLineEvent(textEvent("U1", "สวัสดี"));
    expect(fake.replied.at(-1)?.text).toBe(msg);
    await handleLineEvent({ type: "follow", replyToken: "rt2", source: { userId: "U1" } });
    expect(fake.replied.at(-1)).toEqual({ replyToken: "rt2", text: msg });
  });

  test("unfollow clears lineUserId", async () => {
    const u = await makeUser({ lineUserId: "U9" });
    await handleLineEvent({ type: "unfollow", source: { userId: "U9" } });
    expect((await getUser(u.id)).lineUserId).toBeNull();
  });

  test("unlinkLine clears lineUserId", async () => {
    const u = await makeUser({ lineUserId: "U9" });
    await unlinkLine(u.id);
    expect((await getUser(u.id)).lineUserId).toBeNull();
  });
});

describe("webhook", () => {
  const SECRET = "test-secret";
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.LINE_CHANNEL_SECRET;
    process.env.LINE_CHANNEL_SECRET = SECRET;
  });
  afterEach(() => {
    if (prev === undefined) delete process.env.LINE_CHANNEL_SECRET;
    else process.env.LINE_CHANNEL_SECRET = prev;
  });
  const sign = (body: string) => createHmac("sha256", SECRET).update(body).digest("base64");
  const req = (body: string, sig?: string) =>
    new Request("http://localhost/api/line/webhook", {
      method: "POST",
      body,
      headers: sig ? { "x-line-signature": sig } : {},
    });

  test("webhook rejects bad signature with 401", async () => {
    const body = JSON.stringify({ events: [] });
    expect((await POST(req(body, "bogus"))).status).toBe(401);
    expect((await POST(req(body))).status).toBe(401);
  });

  test("rejects when secret is not configured", async () => {
    process.env.LINE_CHANNEL_SECRET = "";
    const body = JSON.stringify({ events: [] });
    expect((await POST(req(body, sign(body)))).status).toBe(401);
  });

  test("valid signature processes events", async () => {
    const u = await makeUser();
    const { code } = await createLinkCode(u.id);
    const body = JSON.stringify({ events: [textEvent("U5", code)] });
    expect((await POST(req(body, sign(body)))).status).toBe(200);
    expect((await getUser(u.id)).lineUserId).toBe("U5");
  });

  test("one failing event still yields 200", async () => {
    const body = JSON.stringify({ events: [{ type: "message" }, textEvent("U5", "x")] });
    expect((await POST(req(body, sign(body)))).status).toBe(200);
    expect(fake.replied).toHaveLength(1);
  });
});

describe("profile", () => {
  test("updateProfile saves and audits", async () => {
    const u = await makeUser();
    await updateProfile(asSession(u), { name: "ใหม่", department: "HR", phone: "081" });
    expect(await getUser(u.id)).toMatchObject({ name: "ใหม่", department: "HR", phone: "081" });
    expect(await prisma.auditLog.count({ where: { action: "USER_UPDATE_PROFILE" } })).toBe(1);
    await expect(updateProfile(asSession(u), { name: " ", department: "x", phone: "1" })).rejects.toThrow();
  });

  test("changePassword checks current password", async () => {
    const u = await makeUser({ passwordHash: await hashPassword("oldpassword") });
    await expect(changePassword(asSession(u), { current: "wrong", next: "newpassword1" })).rejects.toThrow(
      "รหัสผ่านปัจจุบันไม่ถูกต้อง",
    );
    await expect(changePassword(asSession(u), { current: "oldpassword", next: "short" })).rejects.toThrow();
    await changePassword(asSession(u), { current: "oldpassword", next: "newpassword1" });
    const { verifyPassword } = await import("@/server/auth/password");
    expect(await verifyPassword("newpassword1", (await getUser(u.id)).passwordHash)).toBe(true);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: "USER_CHANGE_PASSWORD" } });
    expect(JSON.stringify(log)).not.toContain("newpassword1");
  });
});
