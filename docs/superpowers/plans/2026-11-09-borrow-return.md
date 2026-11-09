# ระบบยืม-คืนของ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เว็บยืม-คืนของภายในองค์กร: ผู้ยืมสมัครเอง (แอดมินยืนยัน) → ส่งคำขอ → เจ้าหน้าที่อนุมัติ/ส่งมอบ/รับคืน พร้อมแจ้งเตือนในเว็บและ LINE

**Architecture:** Next.js App Router แอปเดียว ตรรกะธุรกิจอยู่ใน `src/server/<module>` (ฟังก์ชัน TypeScript ธรรมดา รับ `actor` และทดสอบได้โดยไม่ผ่าน UI) หน้าเว็บเรียกผ่าน Server Actions บาง ๆ ใน `src/app/**/actions.ts` ฐานข้อมูล PostgreSQL ผ่าน Prisma, LINE ผ่าน interface `LineClient`

**Tech Stack:** Node 22, Next.js 15, React 19, TypeScript (strict), Prisma 6, PostgreSQL 16, Auth.js v5 (`next-auth@5`), Zod, bcryptjs, Tailwind CSS 4, shadcn/ui, Vitest, Playwright, Docker Compose

**Spec:** `docs/superpowers/specs/2026-11-09-borrow-return-design.md`

## Global Constraints

- ข้อความ UI และ error ทั้งหมดเป็นภาษาไทย; ออกแบบ mobile-first
- เขตเวลาตัดสิน "วันนี้" / กำหนดคืน / เวลา 08:00: `Asia/Bangkok` เสมอ (ใช้ `todayBangkok()` จาก Task 1 ห้ามใช้ `new Date()` ตัดวันเอง)
- รหัสผ่าน: bcrypt cost 12, ยาว ≥ 8 ตัว
- ล็อกอินผิด 5 ครั้ง / 15 นาที ต่ออีเมล → ปฏิเสธชั่วคราว
- รูป: jpg/png/webp, ≤ 5MB, ชื่อไฟล์สุ่ม, เก็บที่ `UPLOAD_DIR` (ค่าเริ่ม `/data/uploads`)
- รหัสผูก LINE: 6 หลัก อายุ 10 นาที
- ส่งเตือนรอบเดียวต่อวันเมื่อเวลา Bangkok ≥ 08:00; กันซ้ำด้วย `ReminderLog (loanId, type, date)`
- ส่ง LINE หลัง transaction commit เท่านั้น และความล้มเหลวของ LINE ห้ามทำให้ action หลักล้ม
- ตรวจสิทธิ์ใน server ทุก action; BORROWER เข้าถึงได้เฉพาะ Loan ของตัวเอง
- ข้อความ error ที่ spec กำหนด (ใช้ตรงตัว):
  - `"ของไม่พอในช่วงวันที่เลือก"`
  - `"รายการนี้ถูกดำเนินการไปแล้ว"`
  - `"เลขครุภัณฑ์นี้ถูกยืมอยู่"`
  - `"รอแอดมินยืนยัน"`
  - `"ผูกบัญชีสำเร็จ"`
  - `"รหัสไม่ถูกต้องหรือหมดอายุ"`
- CSV ส่งออกขึ้นต้นด้วย UTF-8 BOM (`﻿`)

## Review Focus

1. **คำขอที่เกินกำหนดแต่ยังไม่คืน** ต้องถูกนับว่ายังใช้ของอยู่ แม้ช่วงวันที่ของมันจะจบไปแล้ว → อนุมัติคำขอใหม่ที่แย่งของชิ้นนั้นไม่ได้ (Task 6: `counts overdue unreturned loans regardless of dates`)
2. **กดรับคืนซ้ำ / คืนเกินจำนวนที่ค้าง** (double submit) → ปฏิเสธ ไม่ให้ `returnedQuantity` เกิน `quantity` และไม่คืน Asset เดิมซ้ำ (Task 8: `rejects returning more than outstanding`)
3. **ใกล้เที่ยงคืนเวลาไทย** (เช่น 23:30 น. = 16:30 UTC) "วันนี้" ต้องเป็นวันที่ตามเวลาไทย ทั้งตอนตรวจ `startDate >= วันนี้` และตอนคำนวณเกินกำหนด (Task 1: `todayBangkok near midnight`)
4. **แก้ `totalQuantity` ให้น้อยกว่าจำนวนที่ถูกยืมค้างอยู่** → ปฏิเสธพร้อมข้อความ และ `availableQuantity` ต้องไม่ติดลบ (Task 5: `rejects totalQuantity below outstanding`, Task 6: `never negative`)
5. **รหัสผูก LINE ที่หมดอายุหรือถูกใช้ไปแล้ว** ส่งซ้ำ → ตอบ `"รหัสไม่ถูกต้องหรือหมดอายุ"` และไม่ผูกบัญชี (Task 10: `rejects expired and reused code`)

---

## File Structure

```
docker-compose.yml            db (5432), db-test (5433), app
Dockerfile, docker-entrypoint.sh
.env.example
prisma/schema.prisma, prisma/seed.ts
src/lib/db.ts                 prisma client singleton + type Db
src/lib/dates.ts              todayBangkok, bangkokHour, parseDateOnly, addDays, diffDaysInclusive
src/lib/result.ts             AppError, Result<T>, toResult()
src/lib/env.ts                อ่าน/ตรวจ env ด้วย Zod
src/server/audit.ts
src/server/auth/password.ts   hashPassword, verifyPassword
src/server/auth/register.ts   registerUser, registerSchema
src/server/auth/credentials.ts authorizeCredentials, rate limit
src/server/auth/session.ts    getCurrentUser, requireRole
src/auth.ts                   Auth.js config
src/middleware.ts
src/server/users.ts
src/server/inventory/categories.ts, items.ts, assets.ts, upload.ts
src/server/loans/dates.ts     validateLoanDates (pure)
src/server/loans/availability.ts
src/server/loans/request.ts   createLoan, cancelLoan
src/server/loans/staff.ts     approveLoan, rejectLoan, handOverLoan, receiveReturn
src/server/loans/status.ts    isOverdue, transition
src/server/line/client.ts     LineClient, HttpLineClient, NoopLineClient, FakeLineClient, verifySignature
src/server/line/link.ts       createLinkCode, unlinkLine, handleLineEvent
src/server/notifications.ts   notify, notifyRole, list/unread/markRead, get/setLineClient
src/server/reminders.ts       runReminders
src/server/reports.ts         dashboardCounts, searchHistory, historyToCsv
src/app/...                   หน้าเว็บตาม spec §6
tests/unit/**, tests/integration/**, tests/e2e/**
tests/integration/helpers.ts  resetDb, makeUser, makeItem, makeLoan
```

---

### Task 1: โครงโปรเจกต์ ฐานข้อมูล และ utility พื้นฐาน

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `docker-compose.yml` (เฉพาะ `db`, `db-test`), `.env.example`, `.gitignore`, `prisma/schema.prisma`, `src/lib/db.ts`, `src/lib/dates.ts`, `src/lib/result.ts`, `src/lib/env.ts`, `tests/integration/helpers.ts`, `tests/integration/setup.ts`
- Test: `tests/unit/dates.test.ts`, `tests/unit/result.test.ts`, `tests/integration/db.test.ts`

**Interfaces:**
- Produces:
  - `prisma` (PrismaClient singleton), `type Db = PrismaClient | Prisma.TransactionClient`
  - `todayBangkok(now?: Date): Date` — คืน Date ที่ 00:00 UTC ของวันที่ตามเวลาไทย (ตรงกับคอลัมน์ `@db.Date`)
  - `bangkokHour(now?: Date): number`
  - `parseDateOnly(s: "YYYY-MM-DD"): Date`, `formatDateOnly(d: Date): string`, `addDays(d: Date, n: number): Date`, `diffDaysInclusive(start: Date, end: Date): number`
  - `class AppError extends Error { constructor(message: string) }`
  - `type Result<T> = { ok: true; data: T } | { ok: false; error: string }`
  - `toResult<T>(fn: () => Promise<T>): Promise<Result<T>>` — จับ `AppError` และ `ZodError` (ข้อความแรก) เป็น `{ok:false}`; error อื่นโยนต่อ
  - helpers: `resetDb()`, `makeUser(o?: Partial<User>): Promise<User>` (ค่าเริ่ม ACTIVE BORROWER), `makeItem(o: {kind, totalQuantity?, assets?: string[], maxLoanDays?}): Promise<Item & {assets: Asset[]}>`, `makeLoan(o: {borrowerId, status, startDate, dueDate, items: {itemId, quantity, returnedQuantity?}[]}): Promise<Loan>`

- [ ] **Step 1: Scaffold** — `npx create-next-app@15 . --ts --tailwind --app --src-dir --eslint --use-npm`, ติดตั้ง `prisma @prisma/client zod bcryptjs next-auth@5 vitest @vitejs/plugin-react dotenv` และ `npx shadcn@latest init`; เพิ่ม scripts: `test:unit` (`vitest run tests/unit`), `test:int` (`vitest run tests/integration --no-file-parallelism`), `test:e2e` (`playwright test`), `db:migrate` (`prisma migrate dev`), `seed` (`tsx prisma/seed.ts`)
- [ ] **Step 2: docker-compose** — `db` (postgres:16, port 5432, volume `pgdata`) และ `db-test` (postgres:16, port 5433, ไม่มี volume); `.env.example` มีทุกตัวแปรจาก spec §10 + `DATABASE_URL_TEST=postgresql://postgres:postgres@localhost:5433/borrow_test`, `UPLOAD_DIR=./data/uploads`
- [ ] **Step 3: เขียน `prisma/schema.prisma`** ตาม spec §4 ทุก model/enum พร้อม relation (`User.loans`, `Loan.items`, `LoanItem.assets`, `Item.assets`, `Item.category` ฯลฯ) และ index `Loan(status)`, `Loan(borrowerId)`, `Notification(userId, readAt)` แล้วรัน `docker compose up -d db db-test` และ `npx prisma migrate dev --name init`
- [ ] **Step 4: เขียนเทสต์ที่ต้อง fail**

```ts
// tests/unit/dates.test.ts
test("todayBangkok near midnight", () => {
  expect(formatDateOnly(todayBangkok(new Date("2026-11-09T16:30:00Z")))).toBe("2026-11-09"); // 23:30 ไทย
  expect(formatDateOnly(todayBangkok(new Date("2026-11-09T17:00:00Z")))).toBe("2026-11-10"); // 00:00 ไทย
});
test("bangkokHour", () => expect(bangkokHour(new Date("2026-11-09T01:00:00Z"))).toBe(8));
test("diffDaysInclusive", () => expect(diffDaysInclusive(parseDateOnly("2026-11-10"), parseDateOnly("2026-11-14"))).toBe(5));

// tests/unit/result.test.ts
test("toResult maps AppError", async () => {
  expect(await toResult(async () => { throw new AppError("x"); })).toEqual({ ok: false, error: "x" });
  expect(await toResult(async () => 1)).toEqual({ ok: true, data: 1 });
});
test("toResult rethrows unknown", async () => {
  await expect(toResult(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
});

// tests/integration/db.test.ts
test("helpers create data", async () => {
  await resetDb();
  const item = await makeItem({ kind: "SERIALIZED", assets: ["NB-1", "NB-2"] });
  expect(item.assets).toHaveLength(2);
});
```

- [ ] **Step 5: รัน `npm run test:unit`** — Expected: FAIL (module not found)
- [ ] **Step 6: Implement** `src/lib/dates.ts` (ใช้ `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" })`), `src/lib/result.ts`, `src/lib/db.ts`, `src/lib/env.ts`, `tests/integration/setup.ts` (ตั้ง `DATABASE_URL = DATABASE_URL_TEST` และรัน `prisma migrate reset --force --skip-seed` ครั้งเดียวใน globalSetup), `tests/integration/helpers.ts` (`resetDb` = `TRUNCATE ... RESTART IDENTITY CASCADE` ทุกตาราง)
- [ ] **Step 7: รัน `npm run test:unit` และ `npm run test:int`** — Expected: PASS ทั้งหมด
- [ ] **Step 8: Commit** — `git add -A; git commit -m "chore: scaffold Next.js, Prisma schema, date/result utils"`

---

### Task 2: Audit, รหัสผ่าน, สมัคร, ล็อกอิน, สิทธิ์ (ตรรกะฝั่ง server)

**Files:**
- Create: `src/server/audit.ts`, `src/server/auth/password.ts`, `src/server/auth/register.ts`, `src/server/auth/credentials.ts`, `src/server/auth/session.ts`
- Test: `tests/unit/password.test.ts`, `tests/integration/auth.test.ts`

**Interfaces:**
- Consumes: `prisma`, `Db`, `AppError`
- Produces:
  - `logAudit(db: Db, e: { actorId: string; action: string; entity: string; entityId: string; data?: unknown }): Promise<void>`
  - `hashPassword(pw: string): Promise<string>`, `verifyPassword(pw: string, hash: string): Promise<boolean>`
  - `registerSchema` (Zod: name, email, password ≥ 8, department, phone), `registerUser(input: unknown): Promise<User>` — สร้าง `PENDING`/`BORROWER`; อีเมลซ้ำ → `AppError("อีเมลนี้ถูกใช้แล้ว")`; หลังสร้างเรียก `onUserRegistered` hook (ค่าเริ่ม no-op; Task 9 ต่อเข้ากับ notify)
  - `type SessionUser = { id: string; name: string; email: string; role: Role }`
  - `authorizeCredentials(email: string, password: string, now?: Date): Promise<SessionUser>` — error: ผิด → `"อีเมลหรือรหัสผ่านไม่ถูกต้อง"`, PENDING → `"รอแอดมินยืนยัน"`, SUSPENDED → `"บัญชีถูกระงับ"`, เกิน limit → `"ลองใหม่อีกครั้งใน 15 นาที"`
  - `resetLoginLimiter(): void` (สำหรับเทสต์)
  - `requireRole(...roles: Role[]): Promise<SessionUser>` และ `getCurrentUser(): Promise<SessionUser | null>` — อ่าน session จาก `auth()` (Task 3) แล้วโหลด User จาก DB; ถ้าไม่ ACTIVE คืน null; `requireRole` โยน `AppError("ไม่มีสิทธิ์")`
  - `assertRole(user: SessionUser, ...roles: Role[]): void` — ตัวตรวจแบบ pure ที่ทุกโมดูลใช้ (ADMIN ผ่านทุกการตรวจ STAFF)

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail**

```ts
// tests/unit/password.test.ts
test("hash/verify", async () => {
  const h = await hashPassword("secret123");
  expect(h).toMatch(/^\$2[aby]\$12\$/);
  expect(await verifyPassword("secret123", h)).toBe(true);
  expect(await verifyPassword("wrong", h)).toBe(false);
});
test("assertRole: ADMIN passes STAFF check, BORROWER fails", () => {
  expect(() => assertRole({ role: "ADMIN" } as SessionUser, "STAFF")).not.toThrow();
  expect(() => assertRole({ role: "BORROWER" } as SessionUser, "STAFF")).toThrow("ไม่มีสิทธิ์");
});

// tests/integration/auth.test.ts
beforeEach(async () => { await resetDb(); resetLoginLimiter(); });
test("register creates PENDING borrower and rejects duplicate", async () => {
  const u = await registerUser({ name: "ก", email: "a@x.th", password: "12345678", department: "IT", phone: "0800000000" });
  expect(u).toMatchObject({ status: "PENDING", role: "BORROWER" });
  await expect(registerUser({ ...sameInput })).rejects.toThrow("อีเมลนี้ถูกใช้แล้ว");
});
test("register rejects short password", async () => { /* password "1234567" → rejects ZodError */ });
test("pending user cannot log in", async () => {
  /* register แล้ว authorizeCredentials → rejects "รอแอดมินยืนยัน" */
});
test("suspended user cannot log in", async () => { /* → "บัญชีถูกระงับ" */ });
test("rate limit after 5 failures in 15 minutes", async () => {
  const t0 = new Date("2026-11-09T03:00:00Z");
  for (let i = 0; i < 5; i++) await expect(authorizeCredentials("a@x.th", "bad", t0)).rejects.toThrow();
  await expect(authorizeCredentials("a@x.th", "correctpw", t0)).rejects.toThrow("ลองใหม่อีกครั้งใน 15 นาที");
  expect(await authorizeCredentials("a@x.th", "correctpw", new Date(t0.getTime() + 15 * 60_000 + 1))).toMatchObject({ email: "a@x.th" });
});
```

- [ ] **Step 2: รัน `npm run test:unit; npm run test:int`** — Expected: FAIL
- [ ] **Step 3: Implement** ไฟล์ทั้งหมดตาม Interfaces; rate limiter เก็บเป็น `Map<email, number[]>` ของ timestamp ที่ผิดในหน่วยความจำ (spec อนุญาตเพราะรัน instance เดียว); ล็อกอินสำเร็จล้างประวัติผิดของอีเมลนั้น
- [ ] **Step 4: รันเทสต์** — Expected: PASS
- [ ] **Step 5: Commit** — `git commit -am "feat(auth): register, credentials login, rate limit, role checks, audit"`

---

### Task 3: Auth.js, middleware, หน้าเข้าสู่ระบบ/สมัคร, layout

**Files:**
- Create: `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/middleware.ts`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`, `src/app/(auth)/actions.ts`, `src/app/(app)/layout.tsx` (header + เมนูตามบทบาท), `src/components/ui/*` (shadcn: button, input, card, table, badge, dialog, form, toast)
- Test: `tests/integration/session.test.ts`

**Interfaces:**
- Consumes: `authorizeCredentials`, `registerUser`, `getCurrentUser`
- Produces: `auth()`, `signIn`, `signOut` จาก `src/auth.ts`; กลุ่ม route `(app)` ที่บังคับล็อกอิน; layout ใช้ `getCurrentUser()` → ถ้า null ให้ `signOut` แล้ว redirect `/login` (ทำให้ผู้ใช้ SUSPENDED ที่ยังมี session ถูกออกจากระบบใน request ถัดไป)

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail**

```ts
// tests/integration/session.test.ts  (mock "@/auth" ให้ auth() คืน session ของ user ที่สร้าง)
test("getCurrentUser returns null for suspended user with live session", async () => {
  const u = await makeUser({ status: "SUSPENDED" });
  mockSession(u.id);
  expect(await getCurrentUser()).toBeNull();
});
test("requireRole rejects borrower for STAFF", async () => {
  const u = await makeUser(); mockSession(u.id);
  await expect(requireRole("STAFF")).rejects.toThrow("ไม่มีสิทธิ์");
});
```

- [ ] **Step 2: รันเทสต์** — Expected: FAIL
- [ ] **Step 3: Implement** Auth.js Credentials provider (`authorize` เรียก `authorizeCredentials` และแปลง AppError เป็น `CredentialsSignin` ที่มี `code` = ข้อความไทย เพื่อแสดงในหน้า login), session strategy `jwt`, callback ใส่ `id`/`role` ลง token; middleware: ไม่ล็อกอิน → `/login` สำหรับทุก path ยกเว้น `/login`, `/register`, `/api/auth/*`, `/api/line/webhook`, `/api/cron/*`, `/uploads/*`; `/staff/*` ต้อง STAFF/ADMIN, `/admin/*` ต้อง ADMIN (จาก token — ตรวจซ้ำใน server action ทุกครั้ง)
- [ ] **Step 4: หน้า register** — สมัครสำเร็จแสดงการ์ด `"สมัครเรียบร้อย รอแอดมินยืนยัน"`; หน้า login แสดง error จาก `code`
- [ ] **Step 5: รันเทสต์ + `npm run build`** — Expected: PASS, build สำเร็จ
- [ ] **Step 6: Commit** — `git commit -am "feat(auth): Auth.js wiring, middleware, login/register pages"`

---

### Task 4: จัดการผู้ใช้ (แอดมิน)

**Files:**
- Create: `src/server/users.ts`, `src/app/(app)/admin/users/page.tsx`, `src/app/(app)/admin/users/actions.ts`
- Test: `tests/integration/users.test.ts`

**Interfaces:**
- Consumes: `assertRole`, `logAudit`, `SessionUser`
- Produces:
  - `listUsers(actor, filter: { status?: UserStatus; q?: string }): Promise<User[]>`
  - `approveUser(actor, userId): Promise<void>` — ต้อง PENDING → ACTIVE (ใช้ `updateMany where status=PENDING`; 0 แถว → `"รายการนี้ถูกดำเนินการไปแล้ว"`)
  - `rejectUser(actor, userId): Promise<void>` — ลบบัญชีที่ PENDING เท่านั้น
  - `suspendUser(actor, userId)`, `activateUser(actor, userId)`, `setRole(actor, userId, role: Role)` — แอดมินเปลี่ยนบทบาท/ระงับตัวเองไม่ได้ → `"ไม่สามารถแก้ไขบัญชีของตัวเองได้"`
  - ทุกฟังก์ชันต้อง ADMIN และเรียก `logAudit` (action: `USER_APPROVE`, `USER_REJECT`, `USER_SUSPEND`, `USER_ACTIVATE`, `USER_SET_ROLE`)

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail**

```ts
test("approve pending user writes audit", async () => {
  const admin = await makeUser({ role: "ADMIN" }); const p = await makeUser({ status: "PENDING" });
  await approveUser(asSession(admin), p.id);
  expect((await prisma.user.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("ACTIVE");
  expect(await prisma.auditLog.count({ where: { action: "USER_APPROVE", entityId: p.id } })).toBe(1);
});
test("approving twice fails", async () => { /* ครั้งที่สอง → "รายการนี้ถูกดำเนินการไปแล้ว" */ });
test("reject deletes only pending", async () => { /* rejectUser บน ACTIVE → throws, ยังอยู่ */ });
test("staff cannot approve", async () => { /* → "ไม่มีสิทธิ์" */ });
test("admin cannot demote self", async () => { /* → "ไม่สามารถแก้ไขบัญชีของตัวเองได้" */ });
```
(`asSession(u: User): SessionUser` เพิ่มใน helpers)

- [ ] **Step 2: รันเทสต์** — Expected: FAIL
- [ ] **Step 3: Implement** `src/server/users.ts`
- [ ] **Step 4: หน้า `/admin/users`** — แท็บ "รอยืนยัน" (ปุ่มยืนยัน/ปฏิเสธ) และ "ผู้ใช้ทั้งหมด" (ค้นหา, เปลี่ยนบทบาท, ระงับ/เปิดใช้); actions ห่อด้วย `requireRole("ADMIN")` + `toResult` + `revalidatePath`
- [ ] **Step 5: รันเทสต์** — Expected: PASS
- [ ] **Step 6: Commit** — `git commit -am "feat(users): admin approve/reject/suspend/role management"`

---

### Task 5: คลังของ — หมวดหมู่ ของ ชิ้นครุภัณฑ์ รูป

**Files:**
- Create: `src/server/inventory/categories.ts`, `items.ts`, `assets.ts`, `upload.ts`, `src/app/uploads/[file]/route.ts` (เสิร์ฟไฟล์จาก `UPLOAD_DIR`), `src/app/(app)/admin/categories/{page,actions}.tsx|ts`, `src/app/(app)/staff/items/page.tsx`, `src/app/(app)/staff/items/[id]/page.tsx`, `src/app/(app)/staff/items/actions.ts`
- Test: `tests/integration/inventory.test.ts`, `tests/unit/upload.test.ts`

**Interfaces:**
- Consumes: `assertRole`, `logAudit`, `outstandingQuantity` (Task 6 — ดูหมายเหตุ Step 3)
- Produces:
  - `createCategory(actor, name)`, `renameCategory(actor, id, name)`, `deleteCategory(actor, id)` — ADMIN; ลบหมวดที่มีของ → `"ลบไม่ได้ เพราะยังมีของในหมวดนี้"`
  - `itemSchema` (name, categoryId, description?, kind, totalQuantity ≥ 0, maxLoanDays 1–365)
  - `createItem(actor, input): Promise<Item>`, `updateItem(actor, id, input): Promise<Item>` — STAFF; เปลี่ยน `kind` หลังสร้างไม่ได้; QUANTITY: `totalQuantity` < จำนวนที่ถูกยืมค้าง (BORROWED) → `"จำนวนรวมน้อยกว่าจำนวนที่ถูกยืมอยู่"`
  - `setItemImage(actor, itemId, file: File)`, `setItemActive(actor, itemId, active: boolean)`
  - `addAsset(actor, itemId, assetTag)` — tag ซ้ำ → `"เลขครุภัณฑ์นี้มีอยู่แล้ว"`; Item ต้องเป็น SERIALIZED
  - `setAssetStatus(actor, assetId, status: "AVAILABLE" | "REPAIR" | "LOST" | "RETIRED")` — Asset ที่ `ON_LOAN` เปลี่ยนไม่ได้ → `"เลขครุภัณฑ์นี้ถูกยืมอยู่"`
  - `listItems(filter: { q?: string; categoryId?: string; includeInactive?: boolean })`, `getItem(id)`
  - `saveUpload(file: File): Promise<string>` คืนชื่อไฟล์ `<uuid>.<ext>`; ผิดชนิด → `"รองรับเฉพาะไฟล์ jpg, png, webp"`, ใหญ่เกิน → `"ไฟล์ต้องไม่เกิน 5MB"`
  - audit actions: `CATEGORY_*`, `ITEM_CREATE`, `ITEM_UPDATE`, `ASSET_ADD`, `ASSET_STATUS`

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail**

```ts
// tests/integration/inventory.test.ts
test("cannot delete category with items", ...);
test("duplicate asset tag rejected", ...);              // "เลขครุภัณฑ์นี้มีอยู่แล้ว"
test("cannot change status of ON_LOAN asset", ...);     // "เลขครุภัณฑ์นี้ถูกยืมอยู่"
test("rejects totalQuantity below outstanding", async () => {
  const staff = await makeUser({ role: "STAFF" });
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 10 });
  await makeLoan({ borrowerId: staff.id, status: "BORROWED", startDate: d("2026-11-09"), dueDate: d("2026-11-12"),
                   items: [{ itemId: item.id, quantity: 6, returnedQuantity: 1 }] });
  await expect(updateItem(asSession(staff), item.id, { ...base, totalQuantity: 4 })).rejects.toThrow("จำนวนรวมน้อยกว่าจำนวนที่ถูกยืมอยู่");
  await expect(updateItem(asSession(staff), item.id, { ...base, totalQuantity: 5 })).resolves.toBeTruthy();
});
test("borrower cannot create item", ...);               // "ไม่มีสิทธิ์"

// tests/unit/upload.test.ts
test("rejects gif and >5MB", async () => {
  await expect(saveUpload(new File(["x"], "a.gif", { type: "image/gif" }))).rejects.toThrow("รองรับเฉพาะไฟล์ jpg, png, webp");
  await expect(saveUpload(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "a.png", { type: "image/png" }))).rejects.toThrow("ไฟล์ต้องไม่เกิน 5MB");
});
```

- [ ] **Step 2: รันเทสต์** — Expected: FAIL
- [ ] **Step 3: Implement** — สำหรับการตรวจ `totalQuantity` ให้ทำ `outstandingQuantity(db, itemId)` ใน `src/server/loans/availability.ts` ตั้งแต่ task นี้ (ผลรวม `quantity - returnedQuantity` ของ LoanItem ใน Loan `BORROWED`) แล้ว Task 6 ขยายไฟล์เดียวกัน; route `/uploads/[file]` ตรวจชื่อไฟล์ด้วย regex `^[0-9a-f-]{36}\.(jpg|png|webp)$` ก่อนอ่าน (กัน path traversal)
- [ ] **Step 4: หน้า** `/admin/categories` (ตาราง + เพิ่ม/แก้ชื่อ/ลบ), `/staff/items` (ตาราง + ค้นหา + ปุ่มเพิ่ม), `/staff/items/[id]` (ฟอร์มของ, อัปโหลดรูป, รายการ Asset + เพิ่ม + เปลี่ยนสถานะ)
- [ ] **Step 5: รันเทสต์** — Expected: PASS
- [ ] **Step 6: Commit** — `git commit -am "feat(inventory): categories, items, assets, image upload"`

---

### Task 6: ตรวจของว่างและวันที่ยืม

**Files:**
- Create: `src/server/loans/dates.ts`, `src/server/loans/status.ts`
- Modify: `src/server/loans/availability.ts`
- Test: `tests/unit/loan-dates.test.ts`, `tests/integration/availability.test.ts`

**Interfaces:**
- Consumes: `Db`, `todayBangkok`, `diffDaysInclusive`
- Produces:
  - `validateLoanDates(start: Date, due: Date, maxLoanDays: number[], today: Date): string | null` — ข้อความ: `"วันยืมต้องไม่ก่อนวันนี้"`, `"วันคืนต้องไม่ก่อนวันยืม"`, `"ยืมได้ไม่เกิน N วัน"` (N = min)
  - `capacity(db, itemId): Promise<number>` — QUANTITY: `totalQuantity` (ถ้า `active=false` → 0); SERIALIZED: นับ Asset ที่สถานะ `AVAILABLE` หรือ `ON_LOAN`
  - `reservedQuantity(db, itemId, start, due, excludeLoanId?): Promise<number>` — ผลรวม `quantity - returnedQuantity` ของ Loan `APPROVED`/`BORROWED` ที่ `startDate <= due AND dueDate >= start` **หรือ** `status = BORROWED AND dueDate < start` (เกินกำหนดยังไม่คืน)
  - `availableQuantity(db, itemId, start, due, excludeLoanId?): Promise<number>` = `max(0, capacity - reserved)`
  - `isOverdue(loan: { status: LoanStatus; dueDate: Date }, today: Date): boolean`
  - `transition(db, loanId, from: LoanStatus[], data: Prisma.LoanUpdateInput): Promise<void>` — `updateMany where {id, status in from}`; 0 แถว → `AppError("รายการนี้ถูกดำเนินการไปแล้ว")`

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail**

```ts
// tests/unit/loan-dates.test.ts
const today = d("2026-11-09");
test.each([
  [d("2026-11-08"), d("2026-11-10"), [7], "วันยืมต้องไม่ก่อนวันนี้"],
  [d("2026-11-10"), d("2026-11-09"), [7], "วันคืนต้องไม่ก่อนวันยืม"],
  [d("2026-11-09"), d("2026-11-16"), [7, 14], "ยืมได้ไม่เกิน 7 วัน"],   // 8 วันรวม
  [d("2026-11-09"), d("2026-11-15"), [7], null],
])("validateLoanDates %#", (s, e, m, want) => expect(validateLoanDates(s, e, m, today)).toBe(want));
test("isOverdue", () => {
  expect(isOverdue({ status: "BORROWED", dueDate: d("2026-11-08") }, today)).toBe(true);
  expect(isOverdue({ status: "BORROWED", dueDate: d("2026-11-09") }, today)).toBe(false);
  expect(isOverdue({ status: "RETURNED", dueDate: d("2026-11-01") }, today)).toBe(false);
});

// tests/integration/availability.test.ts
test("overlapping APPROVED/BORROWED reduce availability; PENDING/REJECTED don't", ...);
test("non-overlapping loan does not reduce availability", ...);
test("partial return frees quantity", ...);             // quantity 5, returned 3 → reserved 2
test("counts overdue unreturned loans regardless of dates", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 2 });
  await makeLoan({ borrowerId: u.id, status: "BORROWED", startDate: d("2026-11-01"), dueDate: d("2026-11-03"), items: [{ itemId: item.id, quantity: 2 }] });
  expect(await availableQuantity(prisma, item.id, d("2026-11-10"), d("2026-11-12"))).toBe(0);
});
test("REPAIR/LOST/RETIRED assets excluded from capacity", ...);
test("never negative", ...);                             // capacity ลดหลังอนุมัติ → 0 ไม่ใช่ -1
test("excludeLoanId ignores that loan", ...);
test("transition fails when status already changed", ...); // "รายการนี้ถูกดำเนินการไปแล้ว"
```

- [ ] **Step 2: รันเทสต์** — Expected: FAIL
- [ ] **Step 3: Implement** ตาม Interfaces (`reservedQuantity` ใช้ `prisma.loanItem.findMany` + รวมใน JS หรือ `$queryRaw` ก็ได้)
- [ ] **Step 4: รันเทสต์** — Expected: PASS
- [ ] **Step 5: Commit** — `git commit -am "feat(loans): availability, date validation, status transition"`

---

### Task 7: ผู้ยืม — เลือกของ ตะกร้า ส่งคำขอ ยกเลิก

**Files:**
- Create: `src/server/loans/request.ts`, `src/app/(app)/items/page.tsx`, `src/app/(app)/items/[id]/page.tsx`, `src/app/(app)/cart/page.tsx`, `src/components/cart-store.ts` (localStorage), `src/app/(app)/my-loans/page.tsx`, `src/app/(app)/my-loans/[id]/page.tsx`, `src/app/(app)/my-loans/actions.ts`, `src/components/loan-status-badge.tsx`
- Test: `tests/integration/loan-request.test.ts`

**Interfaces:**
- Consumes: `validateLoanDates`, `availableQuantity`, `transition`, `isOverdue`, `logAudit`, `todayBangkok`
- Produces:
  - `loanRequestSchema` = `{ startDate: "YYYY-MM-DD", dueDate: "YYYY-MM-DD", purpose: string (1–500), items: { itemId: string; quantity: int ≥ 1 }[] (≥ 1, itemId ไม่ซ้ำ) }`
  - `createLoan(actor: SessionUser, input: unknown, now?: Date): Promise<Loan>` — ตรวจวัน, ของต้อง `active`, ตรวจว่างทุกรายการ (ไม่พอ → `"ของไม่พอในช่วงวันที่เลือก: <ชื่อของ>"`) → สร้าง Loan `PENDING` + LoanItem; audit `LOAN_CREATE`; หลัง commit เรียก hook `onLoanEvent("CREATED", loan)` (no-op จนถึง Task 9)
  - `cancelLoan(actor, loanId): Promise<void>` — เจ้าของคำขอ: จาก `PENDING`/`APPROVED`; STAFF: จาก `APPROVED`; คนอื่น → `"ไม่มีสิทธิ์"`; audit `LOAN_CANCEL`
  - `listMyLoans(actor)`, `getLoanForUser(actor, loanId)` — BORROWER ดูของคนอื่น → `"ไม่มีสิทธิ์"`
  - `type LoanEvent = "CREATED" | "APPROVED" | "REJECTED" | "HANDED_OVER" | "RETURNED" | "CANCELLED"`; `onLoanEvent` อยู่ใน `src/server/loans/events.ts` เป็น `let handler = async (_e, _loan) => {}` + `setLoanEventHandler(fn)`

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail**

```ts
test("creates PENDING loan with items", ...);
test("rejects when not enough available", async () => { /* QUANTITY total 2, ขอ 3 → "ของไม่พอในช่วงวันที่เลือก: จอบ" */ });
test("rejects inactive item", ...);
test("rejects start before today in Bangkok", async () => {
  // now = 2026-11-09T17:30Z (00:30 วันที่ 10 ไทย), startDate 2026-11-09 → "วันยืมต้องไม่ก่อนวันนี้"
});
test("borrower cancels own PENDING; cannot cancel other's; cannot cancel BORROWED", ...);
test("borrower cannot read other's loan", ...);
```

- [ ] **Step 2: รันเทสต์** — Expected: FAIL
- [ ] **Step 3: Implement** `request.ts` + `events.ts`
- [ ] **Step 4: หน้า** `/items` (การ์ดของ ค้นหา กรองหมวด แสดง "ว่างวันนี้ N" จาก `availableQuantity(today, today)`), `/items/[id]` (เลือกจำนวน → เพิ่มลงตะกร้า), `/cart` (รายการ แก้จำนวน เลือกวันยืม/คืน เหตุผล ส่ง → ล้างตะกร้า → ไป `/my-loans/[id]`), `/my-loans` (รายการ + badge สถานะ + ป้ายแดง "เกินกำหนด"), `/my-loans/[id]` (รายละเอียด + ปุ่มยกเลิกเมื่อทำได้); หน้าแรก `/` redirect ไป `/items` (BORROWER) หรือ `/staff` (STAFF/ADMIN)
- [ ] **Step 5: รันเทสต์** — Expected: PASS
- [ ] **Step 6: Commit** — `git commit -am "feat(loans): borrower catalog, cart, request and cancel"`

---

### Task 8: เจ้าหน้าที่ — อนุมัติ ปฏิเสธ ส่งมอบ รับคืน

**Files:**
- Create: `src/server/loans/staff.ts`, `src/app/(app)/staff/loans/page.tsx`, `src/app/(app)/staff/loans/[id]/page.tsx`, `src/app/(app)/staff/loans/actions.ts`
- Test: `tests/integration/loan-staff.test.ts`

**Interfaces:**
- Consumes: `availableQuantity`, `transition`, `onLoanEvent`, `logAudit`, `assertRole`
- Produces:
  - `approveLoan(actor, loanId): Promise<void>` — STAFF; `prisma.$transaction(fn, { isolationLevel: "Serializable" })` retry ≤ 3 ครั้งเมื่อ error code `P2034`; ตรวจว่างทุกรายการโดย `excludeLoanId = loanId` → ไม่พอ `"ของไม่พอในช่วงวันที่เลือก: <ชื่อ>"`; `transition(PENDING → APPROVED)` + `approverId`, `approvedAt`; audit `LOAN_APPROVE`; event `APPROVED`
  - `rejectLoan(actor, loanId, reason: string)` — reason ว่าง → `"กรุณาระบุเหตุผล"`; `PENDING → REJECTED`; audit `LOAN_REJECT`; event `REJECTED`
  - `handOverLoan(actor, loanId, input: { assets: Record<string /*loanItemId*/, string[] /*assetIds*/> })` — `APPROVED → BORROWED`; SERIALIZED ทุก LoanItem ต้องได้ Asset จำนวน = `quantity`, ของ Item นั้น, สถานะ `AVAILABLE` (ไม่ใช่ → `"เลขครุภัณฑ์นี้ถูกยืมอยู่"`, จำนวนไม่ตรง → `"กรุณาเลือกเลขครุภัณฑ์ให้ครบ"`); Asset → `ON_LOAN` ด้วย `updateMany where status=AVAILABLE` (นับไม่ครบ → `"เลขครุภัณฑ์นี้ถูกยืมอยู่"`); สร้าง LoanAsset; `handedOverAt`; audit `LOAN_HANDOVER`; event `HANDED_OVER`
  - `receiveReturn(actor, loanId, input: { serialized: { loanItemId: string; assetId: string; condition: Condition }[]; quantity: { loanItemId: string; quantity: number; condition: Condition }[] })` — Loan ต้อง `BORROWED`; Asset ต้องเป็นของ LoanItem นั้นและ `returnedAt = null` (ไม่ใช่ → `"ชิ้นนี้คืนไปแล้ว"`); QUANTITY ต้อง `quantity ≤ quantity - returnedQuantity` (เกิน → `"จำนวนคืนเกินจำนวนที่ค้าง"`); Asset: GOOD→AVAILABLE, DAMAGED→REPAIR, LOST→LOST; เพิ่ม `returnedQuantity`; คืนครบทุก LoanItem → `transition(BORROWED → RETURNED)` + `returnedAt` + event `RETURNED`; audit `LOAN_RETURN` (data: รายการ + สภาพ); ทั้งหมดใน transaction เดียว
  - `listLoansForStaff(filter: { status?: LoanStatus | "OVERDUE"; q?: string })`, `getLoanForStaff(loanId)` (รวม items, assets, ผู้ยืม, Asset ที่ AVAILABLE ของแต่ละ Item)

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail**

```ts
test("approve succeeds when available and sets approver", ...);
test("approve fails when stock taken by another approved loan", ...);
test("concurrent approvals for last unit: exactly one succeeds", async () => {
  const item = await makeItem({ kind: "QUANTITY", totalQuantity: 1 });
  const [a, b] = await Promise.all([pendingLoan(item, 1), pendingLoan(item, 1)]);
  const r = await Promise.allSettled([approveLoan(staff, a.id), approveLoan(staff, b.id)]);
  expect(r.filter(x => x.status === "fulfilled")).toHaveLength(1);
});
test("reject requires reason", ...);
test("handover assigns assets and marks ON_LOAN", ...);
test("handover rejects asset already ON_LOAN", ...);     // "เลขครุภัณฑ์นี้ถูกยืมอยู่"
test("handover rejects wrong asset count", ...);         // "กรุณาเลือกเลขครุภัณฑ์ให้ครบ"
test("partial return keeps BORROWED; full return sets RETURNED", ...);
test("damaged return sets asset REPAIR", ...);
test("rejects returning more than outstanding", async () => {
  // QUANTITY ยืม 5 คืน 3 แล้ว → คืนอีก 3 → "จำนวนคืนเกินจำนวนที่ค้าง"; Asset ที่คืนแล้วคืนซ้ำ → "ชิ้นนี้คืนไปแล้ว"
});
test("borrower cannot approve", ...);
test("each action fires loan event once", ...);          // ใช้ setLoanEventHandler(spy)
```

- [ ] **Step 2: รันเทสต์** — Expected: FAIL
- [ ] **Step 3: Implement** `staff.ts`
- [ ] **Step 4: หน้า** `/staff/loans` (แท็บ: รออนุมัติ / รอส่งมอบ / กำลังยืม / เกินกำหนด / ทั้งหมด + ค้นหาชื่อผู้ยืม), `/staff/loans/[id]` (ปุ่มตามสถานะ: อนุมัติ, ปฏิเสธ + dialog เหตุผล, ส่งมอบ + เลือก Asset ที่ AVAILABLE ต่อ LoanItem, รับคืน + checkbox Asset/ช่องจำนวน + สภาพ, ยกเลิก)
- [ ] **Step 5: รันเทสต์** — Expected: PASS
- [ ] **Step 6: Commit** — `git commit -am "feat(loans): staff approve, reject, handover, return"`

---

### Task 9: แจ้งเตือนในเว็บ + LineClient + ผูกเหตุการณ์

**Files:**
- Create: `src/server/line/client.ts`, `src/server/notifications.ts`, `src/server/wiring.ts` (ต่อ hook ทั้งหมด import ครั้งเดียวจาก `src/app/(app)/layout.tsx` และ route handlers), `src/components/notification-bell.tsx`, `src/app/(app)/notifications/page.tsx`, `src/app/api/notifications/unread/route.ts`
- Modify: `src/server/auth/register.ts` (hook), `src/server/loans/events.ts` (handler จริงใน wiring)
- Test: `tests/unit/line-signature.test.ts`, `tests/integration/notifications.test.ts`

**Interfaces:**
- Consumes: `setLoanEventHandler`, `onUserRegistered` hook
- Produces:
  - `interface LineClient { enabled: boolean; push(to: string, text: string): Promise<void>; reply(replyToken: string, text: string): Promise<void> }`
  - `HttpLineClient(token)` (POST `https://api.line.me/v2/bot/message/push` และ `/reply`), `NoopLineClient`, `FakeLineClient` (`pushed: {to, text}[]`, `replied: {replyToken, text}[]`)
  - `verifySignature(rawBody: string, signature: string, secret: string): boolean` — base64 HMAC-SHA256, เทียบด้วย `timingSafeEqual`
  - `getLineClient(): LineClient` (Http ถ้ามี `LINE_CHANNEL_ACCESS_TOKEN` ไม่งั้น Noop), `setLineClient(c: LineClient): void`
  - `notify(userIds: string[], message: string, link?: string): Promise<void>` — `createMany` Notification แล้ว push LINE ทีละคนที่มี `lineUserId` แบบ `Promise.allSettled`; ความล้มเหลว `console.error` เท่านั้น
  - `notifyRoles(roles: Role[], message: string, link?: string)` — ผู้ใช้ ACTIVE ในบทบาทนั้น
  - `listNotifications(userId, take = 50)`, `unreadCount(userId)`, `markAllRead(userId)`
  - ข้อความแจ้งเตือน (ใช้ตามนี้):
    - สมัครใหม่ → ADMIN: `"มีผู้สมัครใหม่: <ชื่อ> (<หน่วยงาน>)"` link `/admin/users`
    - CREATED → STAFF+ADMIN: `"คำขอยืมใหม่จาก <ชื่อ> (<n> รายการ)"` link `/staff/loans/<id>`
    - APPROVED → ผู้ยืม: `"คำขอยืมได้รับอนุมัติ มารับของได้ตั้งแต่ <startDate>"`
    - REJECTED → ผู้ยืม: `"คำขอยืมถูกปฏิเสธ: <เหตุผล>"`
    - HANDED_OVER → ผู้ยืม: `"รับของเรียบร้อย กำหนดคืน <dueDate>"`
    - RETURNED → ผู้ยืม: `"คืนของครบเรียบร้อย ขอบคุณครับ"`
    - ลิงก์ของผู้ยืม = `/my-loans/<id>`; วันที่แสดงแบบ `d MMM yyyy` ภาษาไทย (`Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" })`)

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail**

```ts
// tests/unit/line-signature.test.ts
test("verifySignature", () => {
  const sig = createHmac("sha256", "s").update("{}").digest("base64");
  expect(verifySignature("{}", sig, "s")).toBe(true);
  expect(verifySignature("{}", sig, "other")).toBe(false);
  expect(verifySignature("{}", "short", "s")).toBe(false);   // ความยาวต่างต้องไม่ throw
});

// tests/integration/notifications.test.ts
test("notify stores row and pushes only linked users", ...);
test("LINE failure does not throw", async () => {
  setLineClient({ enabled: true, push: async () => { throw new Error("down"); }, reply: async () => {} });
  await expect(notify([linked.id], "x")).resolves.toBeUndefined();
  expect(await unreadCount(linked.id)).toBe(1);
});
test("approving a loan notifies borrower", async () => { /* ผ่าน wiring + FakeLineClient */ });
test("new registration notifies admins", ...);
test("markAllRead", ...);
```

- [ ] **Step 2: รันเทสต์** — Expected: FAIL
- [ ] **Step 3: Implement** ไฟล์ตาม Interfaces; `wiring.ts` เรียก `setLoanEventHandler` และ `setUserRegisteredHandler` ครั้งเดียว (guard ด้วยตัวแปร module)
- [ ] **Step 4: UI** กระดิ่งใน header (fetch `/api/notifications/unread` ทุก 60 วินาที และเมื่อเปลี่ยน path), หน้า `/notifications` (รายการ + "อ่านทั้งหมด")
- [ ] **Step 5: รันเทสต์ทั้งหมด (`test:unit`, `test:int`)** — Expected: PASS
- [ ] **Step 6: Commit** — `git commit -am "feat(notifications): in-app notifications, LINE client, event wiring"`

---

### Task 10: ผูกบัญชี LINE + webhook + หน้าโปรไฟล์

**Files:**
- Create: `src/server/line/link.ts`, `src/app/api/line/webhook/route.ts`, `src/app/(app)/profile/page.tsx`, `src/app/(app)/profile/actions.ts`
- Test: `tests/integration/line-link.test.ts`

**Interfaces:**
- Consumes: `getLineClient`, `verifySignature`, `hashPassword`, `verifyPassword`
- Produces:
  - `createLinkCode(userId, now?: Date): Promise<{ code: string; expiresAt: Date }>` — ลบรหัสเก่าของ user ก่อน; สุ่ม 6 หลักด้วย `crypto.randomInt` ไม่ซ้ำกับรหัสที่ยังไม่หมดอายุ
  - `unlinkLine(userId): Promise<void>`
  - `handleLineEvent(event: { type: string; replyToken?: string; source: { userId: string }; message?: { type: string; text?: string } }, now?: Date): Promise<void>`
    - `message`/`text` ที่เป็นเลข 6 หลัก: รหัสถูกและไม่หมดอายุ → ตั้ง `lineUserId`, ลบรหัส, reply `"ผูกบัญชีสำเร็จ"`; ไม่งั้น reply `"รหัสไม่ถูกต้องหรือหมดอายุ"`; `lineUserId` นี้ผูกกับบัญชีอื่นอยู่ → ย้ายมาบัญชีใหม่ (ล้างของเก่า)
    - ข้อความอื่น → reply `"พิมพ์รหัส 6 หลักจากหน้าโปรไฟล์บนเว็บเพื่อผูกบัญชี"`
    - `unfollow` → ล้าง `lineUserId` ของผู้ใช้ที่ตรงกัน
  - `POST /api/line/webhook`: อ่าน raw body, `verifySignature` ไม่ผ่าน → 401; ผ่าน → `handleLineEvent` ทุก event แล้วตอบ 200
  - `updateProfile(actor, { name, department, phone })`, `changePassword(actor, { current, next })` — current ผิด → `"รหัสผ่านปัจจุบันไม่ถูกต้อง"`

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail**

```ts
test("valid code links account and replies success", ...);
test("rejects expired and reused code", async () => {
  const { code } = await createLinkCode(u.id, new Date("2026-11-09T03:00:00Z"));
  await handleLineEvent(textEvent("U1", code), new Date("2026-11-09T03:10:01Z"));
  expect(fake.replied.at(-1)?.text).toBe("รหัสไม่ถูกต้องหรือหมดอายุ");
  const fresh = await createLinkCode(u.id);
  await handleLineEvent(textEvent("U1", fresh.code));
  await handleLineEvent(textEvent("U2", fresh.code));
  expect(fake.replied.at(-1)?.text).toBe("รหัสไม่ถูกต้องหรือหมดอายุ");
  expect((await getUser(u.id)).lineUserId).toBe("U1");
});
test("unfollow clears lineUserId", ...);
test("webhook rejects bad signature with 401", async () => { /* เรียก POST handler ตรง ๆ ด้วย Request */ });
test("changePassword checks current password", ...);
```

- [ ] **Step 2: รันเทสต์** — Expected: FAIL
- [ ] **Step 3: Implement** ตาม Interfaces
- [ ] **Step 4: หน้า `/profile`** — ฟอร์มข้อมูล, เปลี่ยนรหัสผ่าน, ส่วน LINE: ถ้า `getLineClient().enabled` เป็น false ซ่อนทั้งส่วน; ยังไม่ผูก → ปุ่ม "ผูก LINE" แสดงรหัส + เวลาหมดอายุ + QR ของ `LINE_OA_ADD_FRIEND_URL` (แพ็กเกจ `qrcode`); ผูกแล้ว → "ผูกแล้ว" + ปุ่มยกเลิก
- [ ] **Step 5: รันเทสต์** — Expected: PASS
- [ ] **Step 6: Commit** — `git commit -am "feat(line): account linking, webhook, profile page"`

---

### Task 11: เตือนครบกำหนด / เกินกำหนด (cron)

**Files:**
- Create: `src/server/reminders.ts`, `src/app/api/cron/reminders/route.ts`
- Test: `tests/integration/reminders.test.ts`

**Interfaces:**
- Consumes: `notify`, `notifyRoles`, `todayBangkok`, `bangkokHour`, `addDays`
- Produces:
  - `runReminders(now: Date): Promise<{ skipped: boolean; dueTomorrow: number; overdue: number; digest: boolean }>`
    - `bangkokHour(now) < 8` → `{ skipped: true, ... 0 }`
    - Loan `BORROWED` ที่ `dueDate = today + 1` → ผู้ยืม `"พรุ่งนี้ (<dueDate>) ครบกำหนดคืนของ"` ; type `DUE_TOMORROW`
    - Loan `BORROWED` ที่ `dueDate < today` → ผู้ยืม `"เกินกำหนดคืนแล้ว <n> วัน กรุณาคืนของโดยเร็ว"` ; type `OVERDUE`
    - มีรายการเกินกำหนด ≥ 1 → STAFF+ADMIN `"วันนี้มีรายการเกินกำหนด <n> รายการ"` link `/staff/loans?status=OVERDUE` ; `loanId = "STAFF_DIGEST"`, type `OVERDUE_DIGEST`
    - ก่อนส่งแต่ละรายการ `ReminderLog.create` — ชน unique (`P2002`) = ส่งไปแล้ว ข้าม
  - `POST /api/cron/reminders`: header `Authorization: Bearer <CRON_SECRET>` ไม่ตรง → 401; ตรง → JSON ผลของ `runReminders(new Date())`

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail**

```ts
const at = (iso: string) => new Date(iso);
test("skips before 08:00 Bangkok", async () => {
  expect((await runReminders(at("2026-11-09T00:30:00Z"))).skipped).toBe(true);   // 07:30 ไทย
});
test("sends due-tomorrow and overdue once per day", async () => {
  // loan A due 2026-11-10, loan B due 2026-11-07 (BORROWED)
  const r1 = await runReminders(at("2026-11-09T01:05:00Z"));
  expect(r1).toMatchObject({ dueTomorrow: 1, overdue: 1, digest: true });
  const r2 = await runReminders(at("2026-11-09T02:05:00Z"));
  expect(r2).toMatchObject({ dueTomorrow: 0, overdue: 0, digest: false });
  const r3 = await runReminders(at("2026-11-10T01:05:00Z"));
  expect(r3.overdue).toBe(1);                                                    // เตือนซ้ำวันใหม่
});
test("ignores RETURNED and APPROVED loans", ...);
test("cron route rejects missing secret", ...);
```

- [ ] **Step 2: รันเทสต์** — Expected: FAIL
- [ ] **Step 3: Implement** ตาม Interfaces
- [ ] **Step 4: รันเทสต์** — Expected: PASS
- [ ] **Step 5: Commit** — `git commit -am "feat(reminders): daily due/overdue reminders via cron endpoint"`

---

### Task 12: แดชบอร์ด ประวัติ ส่งออก CSV และ Audit Log

**Files:**
- Create: `src/server/reports.ts`, `src/app/(app)/staff/page.tsx`, `src/app/(app)/staff/history/page.tsx`, `src/app/api/staff/history.csv/route.ts`, `src/app/(app)/admin/audit/page.tsx`
- Test: `tests/unit/csv.test.ts`, `tests/integration/reports.test.ts`

**Interfaces:**
- Consumes: `isOverdue`, `todayBangkok`, `requireRole`
- Produces:
  - `dashboardCounts(today: Date): Promise<{ pending: number; toHandOverToday: number; dueToday: number; overdue: number }>` — `toHandOverToday` = APPROVED ที่ `startDate <= today`; `dueToday` = BORROWED ที่ `dueDate = today`
  - `type HistoryFilter = { borrowerQ?: string; itemId?: string; from?: Date; to?: Date; status?: LoanStatus }` (from/to เทียบกับ `startDate`)
  - `type HistoryRow = { loanId; borrowerName; department; items: string /* "โน้ตบุ๊ก (NB-0012), จอบ x3" */; startDate; dueDate; status; returnedAt: Date | null }`
  - `searchHistory(filter, take = 200): Promise<HistoryRow[]>`
  - `historyToCsv(rows: HistoryRow[]): string` — `﻿` + header `เลขที่,ผู้ยืม,หน่วยงาน,รายการ,วันยืม,กำหนดคืน,สถานะ,วันที่คืน`, CRLF, escape `"` และ `,`/ขึ้นบรรทัดตาม RFC 4180, วันที่ `YYYY-MM-DD`, สถานะเป็นภาษาไทย (`รออนุมัติ, อนุมัติแล้ว, กำลังยืม, คืนแล้ว, ปฏิเสธ, ยกเลิก`)
  - `listAudit(filter: { action?: string; take?: number })`

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail**

```ts
// tests/unit/csv.test.ts
test("csv has BOM, Thai header, escapes", () => {
  const csv = historyToCsv([{ loanId: "L1", borrowerName: 'ก "ข"', department: "IT, ฝ่าย", items: "จอบ x3",
    startDate: d("2026-11-09"), dueDate: d("2026-11-12"), status: "BORROWED", returnedAt: null }]);
  expect(csv.startsWith("﻿เลขที่,ผู้ยืม,")).toBe(true);
  expect(csv).toContain('L1,"ก ""ข""","IT, ฝ่าย",จอบ x3,2026-11-09,2026-11-12,กำลังยืม,');
});

// tests/integration/reports.test.ts
test("dashboardCounts", ...);
test("searchHistory filters by borrower and date range", ...);
test("csv route requires STAFF", ...);
```

- [ ] **Step 2: รันเทสต์** — Expected: FAIL
- [ ] **Step 3: Implement** `reports.ts` + route CSV (`Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="history-<YYYY-MM-DD>.csv"`, รับ filter ทาง query string)
- [ ] **Step 4: หน้า** `/staff` (การ์ดตัวเลข 4 ใบ ลิงก์ไป `/staff/loans?status=...`), `/staff/history` (ฟอร์มกรอง + ตาราง + ปุ่ม "ส่งออก CSV"), `/admin/audit` (ตาราง เวลา/ผู้ทำ/action/entity + กรอง action)
- [ ] **Step 5: รันเทสต์** — Expected: PASS
- [ ] **Step 6: Commit** — `git commit -am "feat(reports): staff dashboard, history, CSV export, audit log"`

---

### Task 13: Docker สำหรับใช้งานจริง, seed, README

**Files:**
- Create: `Dockerfile`, `docker-entrypoint.sh`, `prisma/seed.ts`, `README.md`, `Caddyfile.example`
- Modify: `docker-compose.yml` (เพิ่ม `app`), `next.config.ts` (`output: "standalone"`)
- Test: `tests/integration/seed.test.ts`

**Interfaces:**
- Consumes: `hashPassword`
- Produces: `seed(db: PrismaClient, env: { SEED_ADMIN_EMAIL: string; SEED_ADMIN_PASSWORD: string }): Promise<void>` — idempotent: upsert แอดมิน (ACTIVE, ADMIN, name `"ผู้ดูแลระบบ"`, department `"-"`, phone `"-"`) และหมวด `IT`, `การเกษตร`, `ของใช้ทั่วไป`

- [ ] **Step 1: เขียนเทสต์ที่ต้อง fail**

```ts
test("seed is idempotent", async () => {
  await seed(prisma, env); await seed(prisma, env);
  expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(1);
  expect(await prisma.category.count()).toBe(3);
});
```

- [ ] **Step 2: รันเทสต์** — Expected: FAIL
- [ ] **Step 3: Implement** `seed.ts`; Dockerfile multi-stage (node:22-alpine, `npm ci`, `prisma generate`, `next build`, copy standalone + `prisma/` + `node_modules/.prisma`); entrypoint: `npx prisma migrate deploy && node server.js`; compose `app`: port 3000, `env_file: .env`, volume `uploads:/data/uploads`, `depends_on: db (healthcheck pg_isready)`
- [ ] **Step 4: README (ภาษาไทย)** — หัวข้อ: ความต้องการระบบ, ตั้งค่า `.env`, `docker compose up -d --build`, `docker compose exec app npx tsx prisma/seed.ts`, ตั้ง cron (`0 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/reminders`), สร้าง LINE OA + เปิด Messaging API + ตั้ง webhook `https://<host>/api/line/webhook`, HTTPS ด้วย Caddy (`Caddyfile.example`), สำรอง/กู้คืน (`docker compose exec db pg_dump -U postgres borrow > backup.sql`), พัฒนาในเครื่องและรันเทสต์
- [ ] **Step 5: ตรวจ** — `npm run test:int` PASS; `docker compose up -d --build` แล้ว `curl -I http://localhost:3000/login` ได้ `200`
- [ ] **Step 6: Commit** — `git commit -am "chore(deploy): production Docker image, seed, README"`

---

### Task 14: E2E ครบรอบการยืม

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/full-flow.spec.ts`, `tests/e2e/global-setup.ts`
- Test: `tests/e2e/full-flow.spec.ts`

**Interfaces:**
- Consumes: ทุกหน้า, `seed`; global-setup reset DB ทดสอบ + seed แอดมิน + สร้าง STAFF 1 คน, ของ SERIALIZED "โน้ตบุ๊ก" (NB-0012), QUANTITY "จอบ" (10); รันแอปด้วย `webServer: { command: "npm run build && npm start", env: { DATABASE_URL: DATABASE_URL_TEST } }`

- [ ] **Step 1: เขียนเทสต์**

```ts
test("register → approve user → request → approve → handover → partial/full return", async ({ browser }) => {
  // ผู้ยืม: /register → เห็น "รอแอดมินยืนยัน"; ลองล็อกอิน → เห็น "รอแอดมินยืนยัน"
  // แอดมิน: /admin/users → ยืนยัน
  // ผู้ยืม: ล็อกอิน → /items → เพิ่มโน้ตบุ๊ก 1 + จอบ 3 → /cart วันนี้ถึง +4 วัน → ส่ง → สถานะ "รออนุมัติ"
  // เจ้าหน้าที่: /staff/loans → อนุมัติ → ส่งมอบ เลือก NB-0012 → รับคืนจอบ 3 (สภาพปกติ)
  // ผู้ยืม: สถานะยัง "กำลังยืม"; กระดิ่งมีแจ้งเตือน ≥ 3
  // เจ้าหน้าที่: รับคืน NB-0012 → ผู้ยืมเห็น "คืนแล้ว"
});
```

- [ ] **Step 2: รัน `npm run test:e2e`** — Expected: FAIL ตรงจุดแรกที่ UI ยังไม่ตรง (selector/ข้อความ) — แก้ selector ให้ตรงหน้าจริง ไม่ใช่แก้พฤติกรรม
- [ ] **Step 3: รัน `npm run test:unit; npm run test:int; npm run test:e2e`** — Expected: PASS ทั้งหมด
- [ ] **Step 4: Commit** — `git commit -am "test(e2e): full borrow-return flow"`
