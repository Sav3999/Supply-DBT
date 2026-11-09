# ระบบยืม-คืนของภายในองค์กร — Design Spec

- วันที่: 2026-11-09
- สถานะ: รอรีวิว
- Stack: Next.js (App Router, TypeScript) + PostgreSQL 16 + Prisma, Docker Compose

## 1. เป้าหมายและขอบเขต

### เป้าหมาย
เว็บไซต์สำหรับยืม-คืนของภายในองค์กร/โรงเรียน ใช้งานจริงบนเซิร์ฟเวอร์ มีผู้ใช้หลายคนพร้อมกัน
แทนการจดบันทึกด้วยกระดาษ

### เกณฑ์ความสำเร็จ
- เจ้าหน้าที่ดูได้ทันทีว่าของแต่ละชิ้น/แต่ละรายการอยู่กับใคร และรายการใดเกินกำหนดคืน
- ผู้ยืมส่งคำขอได้เองจากมือถือ และได้รับแจ้งเตือนสถานะผ่านเว็บและ LINE
- ไม่มีการอนุมัติของเกินจำนวนที่มีในช่วงวันเดียวกัน

### ประเภทของ
อุปกรณ์ IT (เช่น โน้ตบุ๊ก), อุปกรณ์การเกษตร, ของใช้ทั่วไป รองรับ 2 แบบ:
- **SERIALIZED** — ติดตามรายชิ้นด้วยเลขครุภัณฑ์ (Asset)
- **QUANTITY** — นับจำนวนรวม

### นอกขอบเขต (เวอร์ชันแรก)
สแกน QR/บาร์โค้ด, ค่าปรับ/มัดจำ, ผู้ยืมขอต่อเวลาเอง, อีเมลแจ้งเตือน, แอปมือถือ native

## 2. บทบาทผู้ใช้

| บทบาท | สิทธิ์ |
|---|---|
| BORROWER | ดูรายการของ, ส่ง/ยกเลิกคำขอของตัวเอง, ผูก LINE |
| STAFF | ทุกอย่างของ BORROWER + อนุมัติ/ปฏิเสธ, ส่งมอบ, รับคืน, จัดการของ, ดู/ส่งออกประวัติ |
| ADMIN | ทุกอย่างของ STAFF + ยืนยัน/ปฏิเสธผู้สมัคร, จัดการผู้ใช้และบทบาท, จัดการหมวดหมู่, ดู Audit Log |

สถานะบัญชี: `PENDING` (สมัครแล้ว รอแอดมินยืนยัน — ล็อกอินไม่ได้), `ACTIVE`, `SUSPENDED` (ล็อกอินไม่ได้)
ผู้สมัครใหม่ได้บทบาท BORROWER เสมอ

## 3. สถาปัตยกรรม

```
เบราว์เซอร์
   │
Next.js (App Router)
   ├─ Server Components / Server Actions  (UI + mutations)
   ├─ Auth.js (Credentials: อีเมล + รหัสผ่าน, session แบบ JWT)
   ├─ POST /api/line/webhook      ← LINE Messaging API
   └─ POST /api/cron/reminders    ← cron ภายนอก (header: Authorization: Bearer CRON_SECRET)
   │
Prisma ORM
   │
PostgreSQL 16
```

### โมดูล (แยกตามหน้าที่ — ตรรกะอยู่ใน `src/server/<module>` ไม่ผูกกับ UI)
| โมดูล | หน้าที่ | ขึ้นกับ |
|---|---|---|
| `auth` | สมัคร, ล็อกอิน, session, ตรวจสิทธิ์ (`requireRole`) | db |
| `users` | ยืนยัน/ระงับผู้ใช้, เปลี่ยนบทบาท | auth, notifications, audit |
| `inventory` | Category, Item, Asset, การอัปโหลดรูป | db, audit |
| `loans` | คำขอยืม, ตรวจของว่าง, อนุมัติ, ส่งมอบ, รับคืน, ยกเลิก | inventory, notifications, audit |
| `notifications` | `notify()`, การแจ้งเตือนในเว็บ, การเตือนตามเวลา | db, line |
| `line` | interface `LineClient` (push, verify signature), การผูกบัญชี | — |
| `audit` | `logAudit(actorId, action, entity, entityId, data)` | db |

## 4. โครงสร้างข้อมูล (Prisma)

```prisma
enum Role        { BORROWER STAFF ADMIN }
enum UserStatus  { PENDING ACTIVE SUSPENDED }
enum ItemKind    { SERIALIZED QUANTITY }
enum AssetStatus { AVAILABLE ON_LOAN REPAIR LOST RETIRED }
enum LoanStatus  { PENDING APPROVED BORROWED RETURNED REJECTED CANCELLED }
enum Condition   { GOOD DAMAGED LOST }

model User {
  id            String     @id @default(cuid())
  name          String
  email         String     @unique
  passwordHash  String
  department    String
  phone         String
  role          Role       @default(BORROWER)
  status        UserStatus @default(PENDING)
  lineUserId    String?    @unique
  createdAt     DateTime   @default(now())
}

model LineLinkCode {
  code      String   @id          // 6 หลัก
  userId    String
  expiresAt DateTime              // now + 10 นาที
}

model Category { id String @id @default(cuid()); name String @unique }

model Item {
  id            String   @id @default(cuid())
  name          String
  categoryId    String
  description   String?
  imagePath     String?
  kind          ItemKind
  totalQuantity Int      @default(0)   // ใช้เฉพาะ QUANTITY
  maxLoanDays   Int      @default(7)
  active        Boolean  @default(true)
}

model Asset {
  id        String      @id @default(cuid())
  itemId    String
  assetTag  String      @unique        // เลขครุภัณฑ์
  status    AssetStatus @default(AVAILABLE)
}

model Loan {
  id           String     @id @default(cuid())
  borrowerId   String
  startDate    DateTime   @db.Date
  dueDate      DateTime   @db.Date
  purpose      String
  status       LoanStatus @default(PENDING)
  approverId   String?
  rejectReason String?
  approvedAt   DateTime?
  handedOverAt DateTime?
  returnedAt   DateTime?
  createdAt    DateTime   @default(now())
}

model LoanItem {
  id               String     @id @default(cuid())
  loanId           String
  itemId           String
  quantity         Int                    // SERIALIZED: จำนวนชิ้นที่ขอ
  returnedQuantity Int        @default(0)
  assets           LoanAsset[]
}

model LoanAsset {                         // ชิ้นที่ส่งมอบจริง (SERIALIZED)
  loanItemId  String
  assetId     String
  returnedAt  DateTime?
  condition   Condition?
  @@id([loanItemId, assetId])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  message   String
  link      String?
  readAt    DateTime?
  createdAt DateTime @default(now())
}

model ReminderLog {                       // กันส่งเตือนซ้ำ
  loanId String
  type   String                           // DUE_TOMORROW | OVERDUE
  date   DateTime @db.Date
  @@id([loanId, type, date])
}

model AuditLog {
  id        String   @id @default(cuid())
  actorId   String
  action    String
  entity    String
  entityId  String
  data      Json?
  createdAt DateTime @default(now())
}
```

การคืนของ QUANTITY ที่ชำรุด/สูญหาย: บันทึกใน `AuditLog` และเจ้าหน้าที่ลด `totalQuantity` ผ่านหน้าจัดการของ

## 5. กติกาของคำขอยืม

### สถานะ
```
PENDING ──อนุมัติ──▶ APPROVED ──ส่งมอบ──▶ BORROWED ──คืนครบ──▶ RETURNED
   ├─ปฏิเสธ (ต้องมีเหตุผล)─▶ REJECTED
   └─ยกเลิก─▶ CANCELLED      APPROVED ─ยกเลิก─▶ CANCELLED
```
- ผู้ยืมยกเลิกได้เมื่อ PENDING หรือ APPROVED; เจ้าหน้าที่ยกเลิกได้เมื่อ APPROVED
- **เกินกำหนด** = `status = BORROWED` และ `dueDate < วันนี้ (Asia/Bangkok)` — คำนวณ ไม่เก็บเป็นสถานะ
- ทุกการเปลี่ยนสถานะเช็กสถานะเดิมใน `UPDATE ... WHERE status = <เดิม>` ถ้าไม่มีแถวถูกแก้ → error "รายการนี้ถูกดำเนินการไปแล้ว"

### การส่งคำขอ
- ต้องมีอย่างน้อย 1 รายการ, `startDate >= วันนี้`, `dueDate >= startDate`
- `dueDate - startDate + 1 <= min(maxLoanDays ของทุกรายการ)`
- ตรวจของว่างเบื้องต้น (ให้ผู้ใช้รู้เร็ว) แต่การกันจองจริงเกิดตอนอนุมัติ

### การตรวจของว่าง (`availableQuantity(itemId, start, due)`)
- ความจุ: QUANTITY = `totalQuantity`; SERIALIZED = จำนวน Asset ที่สถานะไม่ใช่ `REPAIR/LOST/RETIRED`
- ใช้ไป = ผลรวม `quantity - returnedQuantity` ของ LoanItem ใน Loan สถานะ `APPROVED` หรือ `BORROWED`
  ที่ช่วงวันทับกัน (`loan.startDate <= due AND loan.dueDate >= start`) รวมคำขอที่เกินกำหนดซึ่งยังไม่คืนเสมอ
- ว่าง = ความจุ − ใช้ไป

### การอนุมัติ
ทำใน transaction ระดับ `Serializable` (retry สูงสุด 3 ครั้งเมื่อ serialization failure):
ตรวจของว่างทุกรายการ → ถ้าไม่พอ แจ้งรายการที่ขาด และไม่อนุมัติ → ถ้าพอ เปลี่ยนเป็น APPROVED

### การส่งมอบ
- SERIALIZED: เจ้าหน้าที่เลือก Asset สถานะ `AVAILABLE` ให้ครบตาม `quantity` → Asset เป็น `ON_LOAN`
- QUANTITY: ยืนยันจำนวน
- Loan → BORROWED, บันทึก `handedOverAt`

### การรับคืน (คืนบางส่วนได้)
- SERIALIZED: เลือก Asset ที่คืน + สภาพ → GOOD: `AVAILABLE`, DAMAGED: `REPAIR`, LOST: `LOST`
- QUANTITY: ระบุจำนวนที่คืน (ไม่เกินที่ค้าง) + สภาพ
- ปรับ `returnedQuantity`; เมื่อทุก LoanItem คืนครบ → Loan RETURNED, บันทึก `returnedAt`

## 6. หน้าจอ

UI ภาษาไทย, ออกแบบ mobile-first, ใช้ Tailwind CSS + shadcn/ui

| เส้นทาง | บทบาท | รายละเอียด |
|---|---|---|
| `/login`, `/register` | ทุกคน | สมัครแล้วขึ้น "รอแอดมินยืนยัน"; ล็อกอินบัญชี PENDING ได้ข้อความเดียวกัน |
| `/items`, `/items/[id]` | ทุกคนที่ล็อกอิน | ค้นหา/กรองหมวด, แสดงจำนวนที่ว่างวันนี้, เพิ่มลงตะกร้า |
| `/cart` | BORROWER+ | เลือกวัน, เหตุผล, ส่งคำขอ (ตะกร้าเก็บใน localStorage) |
| `/my-loans`, `/my-loans/[id]` | BORROWER+ | สถานะ, ยกเลิก, ป้ายเกินกำหนด |
| `/profile` | BORROWER+ | แก้ข้อมูล, เปลี่ยนรหัสผ่าน, ผูก/ยกเลิก LINE |
| `/staff` | STAFF+ | แดชบอร์ด: รออนุมัติ, ส่งมอบวันนี้, ครบกำหนดวันนี้, เกินกำหนด |
| `/staff/loans`, `/staff/loans/[id]` | STAFF+ | อนุมัติ/ปฏิเสธ, ส่งมอบ, รับคืน |
| `/staff/items` | STAFF+ | CRUD ของ, รูป, Asset, เปลี่ยนสถานะ Asset |
| `/staff/history` | STAFF+ | ค้นหาตามผู้ยืม/ของ/ช่วงวัน, ส่งออก CSV (UTF-8 BOM ให้ Excel อ่านไทยได้) |
| `/admin/users` | ADMIN | ยืนยัน/ปฏิเสธผู้สมัคร (ปฏิเสธ = ลบบัญชี PENDING), เปลี่ยนบทบาท, ระงับ |
| `/admin/categories` | ADMIN | CRUD หมวดหมู่ (ลบได้เมื่อไม่มีของ) |
| `/admin/audit` | ADMIN | ดู Audit Log |

กระดิ่งแจ้งเตือนบน header: จำนวนที่ยังไม่อ่าน, poll ทุก 60 วินาที, หน้า `/notifications`

## 7. การแจ้งเตือน

`notify(userIds, message, link?)`: สร้าง `Notification` เสมอ → ถ้ามี `lineUserId` ส่ง LINE push
ข้อผิดพลาดจาก LINE ถูก log และไม่ทำให้ action หลักล้ม (ส่งหลัง transaction commit)

| เหตุการณ์ | ผู้รับ |
|---|---|
| ผู้สมัครใหม่ | ADMIN ทุกคน |
| คำขอยืมใหม่ | STAFF + ADMIN ทุกคน |
| อนุมัติ / ปฏิเสธ (พร้อมเหตุผล) | ผู้ยืม |
| ส่งมอบแล้ว (พร้อมวันกำหนดคืน) | ผู้ยืม |
| พรุ่งนี้ครบกำหนด | ผู้ยืม |
| เกินกำหนด (วันละครั้ง) | ผู้ยืม; STAFF ได้สรุปรายการเกินกำหนดวันละครั้ง |
| รับคืนครบ | ผู้ยืม |

### งานตามเวลา
cron เรียก `/api/cron/reminders` ทุกชั่วโมง; ทำงานจริงเมื่อเวลา Asia/Bangkok ≥ 08:00
ใช้ `ReminderLog` กันส่งซ้ำต่อ `(loanId, type, date)`; สรุปของ STAFF ใช้ `loanId = "STAFF_DIGEST"`

### การผูก LINE
1. หน้าโปรไฟล์สร้างรหัส 6 หลัก อายุ 10 นาที + QR/ลิงก์เพิ่มเพื่อน OA
2. ผู้ใช้พิมพ์รหัสในแชต OA → webhook ตรวจลายเซ็น, ตรวจรหัส, บันทึก `lineUserId`, ลบรหัส, ตอบ "ผูกบัญชีสำเร็จ"
3. รหัสผิด/หมดอายุ → ตอบ "รหัสไม่ถูกต้องหรือหมดอายุ"
4. event `unfollow` → ล้าง `lineUserId`
- ถ้าไม่ได้ตั้งค่า `LINE_*` ระบบใช้ `NoopLineClient` (แจ้งเตือนในเว็บอย่างเดียว) และซ่อนปุ่มผูก LINE
- หมายเหตุ: LINE OA แพ็กเกจฟรีจำกัดจำนวน push ต่อเดือน

## 8. ข้อผิดพลาดและความปลอดภัย

- ตรวจ input ด้วย Zod ทั้ง client และ server; ข้อความภาษาไทย
- Server action คืน `{ ok: true, data } | { ok: false, error }` สำหรับข้อผิดพลาดทางธุรกิจ
- error ที่ไม่คาดคิด → หน้า error พร้อมรหัสอ้างอิง, รายละเอียดลง log
- รหัสผ่าน bcrypt (cost 12), ความยาว ≥ 8
- จำกัดล็อกอินผิด 5 ครั้ง / 15 นาที ต่ออีเมล (เก็บในตาราง หรือในหน่วยความจำสำหรับ instance เดียว)
- ตรวจสิทธิ์ใน server ทุก action ด้วย `requireRole()`; BORROWER เข้าถึงได้เฉพาะ Loan ของตัวเอง
- session ถูกตรวจสถานะผู้ใช้ทุก request: SUSPENDED → ออกจากระบบ
- webhook LINE ตรวจ `x-line-signature` (HMAC-SHA256); cron ตรวจ `CRON_SECRET`
- อัปโหลดรูป: jpg/png/webp, ≤ 5MB, ตั้งชื่อไฟล์ใหม่แบบสุ่ม, เก็บใน volume `/data/uploads`
- AuditLog: ยืนยัน/ปฏิเสธ/ระงับผู้ใช้, เปลี่ยนบทบาท, อนุมัติ, ปฏิเสธ, ยกเลิก, ส่งมอบ, รับคืน, CRUD ของ/Asset/หมวดหมู่

## 9. การทดสอบ (TDD)

| ระดับ | เครื่องมือ | ครอบคลุม |
|---|---|---|
| Unit | Vitest | `availableQuantity`, การเปลี่ยนสถานะ, คืนบางส่วน, เกินกำหนด, การเลือก reminder, ตรวจวันยืม |
| Integration | Vitest + PostgreSQL (Docker, DB แยกสำหรับเทสต์) | server modules กับ DB จริง, อนุมัติพร้อมกัน 2 รายการแย่งของชิ้นสุดท้าย, สิทธิ์, webhook LINE (ลายเซ็นถูก/ผิด) |
| E2E | Playwright | สมัคร → แอดมินยืนยัน → ขอยืม → อนุมัติ → ส่งมอบ → คืน |

`LineClient` เป็น interface — เทสต์ใช้ `FakeLineClient` ที่เก็บข้อความไว้ตรวจสอบ

## 10. การติดตั้ง

- `docker-compose.yml`: `app` (Next.js standalone build), `db` (postgres:16), volume `pgdata`, `uploads`
- `.env.example`: `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `APP_URL`,
  `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_OA_ADD_FRIEND_URL`,
  `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`
- ตอนคอนเทนเนอร์เริ่ม: `prisma migrate deploy`
- `npm run seed`: สร้างแอดมินคนแรก (ACTIVE) จาก `SEED_ADMIN_*` + หมวด IT / การเกษตร / ของใช้ทั่วไป
- README: ติดตั้ง, ตั้ง cron (`curl` ทุกชั่วโมง), สร้าง LINE OA + ตั้ง webhook URL, reverse proxy HTTPS (Caddy), สำรองข้อมูลด้วย `pg_dump`
- เขตเวลาที่ใช้ตัดสินวัน: `Asia/Bangkok`
