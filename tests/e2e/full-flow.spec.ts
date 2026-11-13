import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN, BORROWER, STAFF } from "./accounts";

const DAY_MS = 86_400_000;
const bangkokDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Bangkok",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function addDays(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

async function login(page: Page, who: { email: string; password: string }, expectSuccess = true) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(who.email);
  await page.getByLabel("รหัสผ่าน").fill(who.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  // wait for the sign-in redirect to finish so later goto() calls carry the session cookie
  if (expectSuccess) await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

// loan status badge (Badge renders data-slot="badge"); exact match so "(คืนแล้ว 3)" text never counts
function statusBadge(page: Page, label: string) {
  return page.locator('[data-slot="badge"]').getByText(label, { exact: true });
}

async function unreadCount(page: Page): Promise<number> {
  const bell = page.getByRole("link", { name: /การแจ้งเตือน/ });
  await expect(bell).toHaveAttribute("aria-label", /\(\d+ ยังไม่อ่าน\)/);
  const label = (await bell.getAttribute("aria-label")) ?? "";
  return Number(/\((\d+) ยังไม่อ่าน\)/.exec(label)?.[1] ?? 0);
}

async function newPage(browser: Browser) {
  const context = await browser.newContext({ locale: "th-TH", timezoneId: "Asia/Bangkok" });
  return { context, page: await context.newPage() };
}

test("register → approve user → request → approve → handover → partial/full return", async ({ browser }) => {
  const today = bangkokDate.format(new Date());
  const due = addDays(today, 4);

  const borrower = await newPage(browser);
  const admin = await newPage(browser);
  const staff = await newPage(browser);
  const b = borrower.page;

  // ผู้ยืม: สมัคร -> เห็นรอแอดมินยืนยัน; ลองล็อกอินก่อนอนุมัติ -> ถูกปฏิเสธด้วยข้อความเดียวกัน
  await b.goto("/register");
  await b.getByLabel("ชื่อ-นามสกุล").fill("ผู้ยืมทดสอบ");
  await b.getByLabel("อีเมล").fill(BORROWER.email);
  await b.getByLabel("รหัสผ่าน").fill(BORROWER.password);
  await b.getByLabel("หน่วยงาน").fill("ฝ่ายทดสอบ");
  await b.getByLabel("เบอร์โทร").fill("0822222222");
  await b.getByRole("button", { name: "สมัครใช้งาน" }).click();
  await expect(b.getByText("รอแอดมินยืนยัน")).toBeVisible();

  await login(b, BORROWER, false);
  await expect(b.getByText("รอแอดมินยืนยัน")).toBeVisible();
  await expect(b).toHaveURL(/\/login/);

  // แอดมิน: ยืนยันผู้ใช้
  await login(admin.page, ADMIN);
  await admin.page.goto("/admin/users");
  const row = admin.page.getByRole("row").filter({ hasText: BORROWER.email });
  await row.getByRole("button", { name: "ยืนยัน" }).click();
  await expect(admin.page.getByRole("row").filter({ hasText: BORROWER.email })).toHaveCount(0);
  // positive outcome: the user now shows as active (ใช้งาน) on the all-users tab
  await admin.page.goto("/admin/users?tab=all");
  await expect(
    admin.page.getByRole("row").filter({ hasText: BORROWER.email }).locator('[data-slot="badge"]', { hasText: "ใช้งาน" }),
  ).toBeVisible();

  // ผู้ยืม: ล็อกอิน -> เลือกของใส่ตะกร้า
  await login(b, BORROWER);
  await b.goto("/items");
  await b.getByRole("link", { name: /โน้ตบุ๊ก/ }).click();
  await b.getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
  await expect(b.getByText("เพิ่มลงตะกร้าแล้ว")).toBeVisible();

  await b.goto("/items");
  await b.getByRole("link", { name: /จอบ/ }).click();
  await b.getByLabel("จำนวน").fill("3");
  await b.getByRole("button", { name: "เพิ่มลงตะกร้า" }).click();
  await expect(b.getByText("เพิ่มลงตะกร้าแล้ว")).toBeVisible();

  // ตะกร้า: วันนี้ ถึง +4 วัน
  await b.goto("/cart");
  await expect(b.getByText("โน้ตบุ๊ก")).toBeVisible();
  await b.getByLabel("วันยืม").fill(today);
  await b.getByLabel("วันคืน").fill(due);
  await b.getByLabel("เหตุผลการยืม").fill("ใช้งานโครงการทดสอบ E2E");
  await b.getByRole("button", { name: "ส่งคำขอยืม" }).click();
  await expect(b).toHaveURL(/\/my-loans\/[^/]+$/);
  await expect(b.getByText("รออนุมัติ")).toBeVisible();
  const myLoanUrl = b.url();

  // เจ้าหน้าที่: อนุมัติ
  await login(staff.page, STAFF);
  const s = staff.page;
  await s.goto("/staff/loans?status=PENDING");
  await s.getByRole("link", { name: /ผู้ยืมทดสอบ/ }).click();
  await s.getByRole("button", { name: "อนุมัติ", exact: true }).click();
  await expect(statusBadge(s, "อนุมัติแล้ว")).toBeVisible();

  // ส่งมอบ เลือก NB-0012
  await s.getByLabel("NB-0012").check();
  await s.getByRole("button", { name: "ยืนยันส่งมอบ" }).click();
  await expect(statusBadge(s, "กำลังยืม")).toBeVisible();
  // NB-0012 is shown as the handed-over (not yet returned) asset of the laptop line
  const laptopLine = s.getByRole("listitem").filter({ hasText: "โน้ตบุ๊ก" }).filter({ hasText: "NB-0012" });
  await expect(laptopLine.getByText("NB-0012 · ยังไม่คืน")).toBeVisible();

  // รับคืนจอบ 3 (สภาพปกติ)
  await s.getByLabel("จำนวนคืน จอบ").fill("3");
  await s.getByLabel("สภาพ จอบ").selectOption("GOOD");
  await s.getByRole("button", { name: "บันทึกรับคืน" }).click();
  await expect(s.getByText("3 ชิ้น (คืนแล้ว 3)")).toBeVisible();

  // ผู้ยืม: ยังกำลังยืม; กระดิ่งมีแจ้งเตือนแล้ว
  // (ตาม spec §7 / wiring.ts การคืนบางส่วนไม่สร้างแจ้งเตือน ณ จุดนี้จึงมี 2: อนุมัติ + ส่งมอบ;
  //  แจ้งเตือนที่ 3 "คืนของครบ" เกิดหลังรับคืนครบ จึงตรวจ >= 3 ท้ายเทสต์)
  await b.goto(myLoanUrl);
  await expect(b.getByText("กำลังยืม")).toBeVisible();
  expect(await unreadCount(b)).toBeGreaterThanOrEqual(2);

  // เจ้าหน้าที่: รับคืน NB-0012 -> ผู้ยืมเห็นคืนแล้ว
  await s.reload();
  await s.getByRole("checkbox", { name: "NB-0012" }).check();
  await s.getByRole("button", { name: "บันทึกรับคืน" }).click();
  await expect(statusBadge(s, "คืนแล้ว")).toBeVisible();
  await expect(laptopLine.getByText("NB-0012 · คืนแล้ว (ปกติ)")).toBeVisible();

  await b.goto(myLoanUrl);
  await expect(b.getByText("คืนแล้ว", { exact: true })).toBeVisible();
  expect(await unreadCount(b)).toBeGreaterThanOrEqual(3);

  await Promise.all([borrower.context.close(), admin.context.close(), staff.context.close()]);
});
