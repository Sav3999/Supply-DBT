# เว็บไซต์คลังวัสดุ DBT

ระบบยืม-คืนวัสดุและอุปกรณ์ของแผนกเทคโนโลยีธุรกิจดิจิทัล (DBT)
สร้างด้วย Next.js 15 (App Router), Prisma 6, PostgreSQL และ next-auth v5

Repository: https://github.com/Sav3999/Supply-DBT

## ฟีเจอร์หลัก

- สมัครสมาชิก แล้วรอแอดมินอนุมัติบัญชีก่อนใช้งาน
- ดูรายการวัสดุ/อุปกรณ์ พร้อมจำนวนที่ว่างในช่วงวันที่เลือก (ทั้งแบบนับจำนวนและแบบมีเลขครุภัณฑ์)
- ขอยืม -> เจ้าหน้าที่อนุมัติ -> รับของ -> รับคืน (บันทึกสภาพ: ปกติ/ชำรุด/สูญหาย)
- แจ้งเตือนในระบบ และแจ้งเตือนผ่าน LINE (ผูกบัญชีด้วยรหัส 6 หลัก อายุ 10 นาที)
- แจ้งเตือนอัตโนมัติรายวันสำหรับของที่ใกล้ถึงกำหนด/เกินกำหนดคืน (ผ่าน cron endpoint)
- แดชบอร์ดเจ้าหน้าที่ ประวัติการยืม ส่งออก CSV และบันทึกการใช้งาน (audit log)

## บทบาทผู้ใช้

| บทบาท | สิทธิ์ |
| --- | --- |
| `BORROWER` ผู้ยืม | ดูรายการ ขอยืม ดูเฉพาะรายการยืมของตัวเอง |
| `STAFF` เจ้าหน้าที่ | จัดการวัสดุ อนุมัติ/ปฏิเสธคำขอ รับของ รับคืน ดูรายงาน |
| `ADMIN` แอดมิน | ทำได้ทุกอย่างของเจ้าหน้าที่ และอนุมัติผู้ใช้/จัดการบทบาท |

## ความต้องการระบบ

- สำหรับ production: Docker + Docker Compose (v2), โดเมนหนึ่งชื่อ (ถ้าต้องการ HTTPS)
- สำหรับพัฒนา: Node.js 22 ขึ้นไป และ PostgreSQL 16 ขึ้นไป

## พัฒนาในเครื่อง

```bash
npm install
cp .env.example .env          # แล้วแก้ค่าใน .env
npx prisma migrate dev        # สร้างตารางในฐานข้อมูล
npm run seed                  # สร้างแอดมินและหมวดหมู่เริ่มต้น
npm run dev                   # เปิดที่ http://localhost:3000
```

ถ้าไม่มี PostgreSQL ในเครื่อง ใช้ Docker ช่วยได้: `docker compose up -d db db-test`
(`db-test` ใช้เฉพาะตอนพัฒนา/รันเทสต์ ไม่จำเป็นบน production)

### รันเทสต์

```bash
npm run test:unit   # unit test
npm run test:int    # integration test (ต้องมีฐานข้อมูลทดสอบ)
npm run lint
```

`test:int` ต้องตั้ง `DATABASE_URL_TEST` ใน `.env` ให้ชี้ไปยังฐานข้อมูลที่**ชื่อลงท้ายด้วย `_test`**
(เช่น `borrow_test`) เพราะเทสต์จะล้างข้อมูลทุกตารางก่อนแต่ละเคส ระบบมีตัวป้องกันไม่ให้รันกับฐานข้อมูลอื่น

## ตั้งค่า `.env`

คัดลอก `.env.example` เป็น `.env` แล้วตั้งค่าดังนี้

| ตัวแปร | คำอธิบาย |
| --- | --- |
| `DATABASE_URL` | URL ฐานข้อมูล (ใน Docker Compose จะถูกแทนที่ให้ชี้ไปที่บริการ `db` อัตโนมัติ) |
| `DATABASE_URL_TEST` | ฐานข้อมูลสำหรับเทสต์ (ชื่อต้องลงท้าย `_test`) |
| `POSTGRES_PASSWORD` | รหัสผ่านฐานข้อมูลของ Docker Compose (ค่าเริ่มต้น `postgres` ใช้ตอนพัฒนาเท่านั้น) มีผลเมื่อสร้าง volume `pgdata` ครั้งแรกเท่านั้น (เปลี่ยนภายหลังต้องเปลี่ยนในฐานข้อมูลเอง) และห้ามมีอักขระ `@ / # :` เว้นแต่ URL-encode แล้ว เพราะถูกนำไปต่อเป็น `DATABASE_URL` |
| `AUTH_SECRET` | คีย์เซ็นเซสชัน สร้างด้วย `openssl rand -base64 32` |
| `CRON_SECRET` | รหัสลับสำหรับเรียก endpoint แจ้งเตือนรายวัน |
| `APP_URL` | URL จริงของเว็บ เช่น `https://borrow.example.com` |
| `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` | จาก LINE Developers Console |
| `LINE_OA_ADD_FRIEND_URL` | ลิงก์เพิ่มเพื่อนของ LINE OA (แสดงในหน้าโปรไฟล์) |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | อีเมล/รหัสผ่านแอดมินคนแรก (รหัสผ่านยาวอย่างน้อย 8 ตัว) |
| `UPLOAD_DIR` | โฟลเดอร์เก็บรูป (ใน Docker คือ `/data/uploads`) |

## ติดตั้งบน production ด้วย Docker

```bash
cp .env.example .env
# แก้ .env: POSTGRES_PASSWORD, AUTH_SECRET, CRON_SECRET, APP_URL, SEED_ADMIN_*, LINE_*
docker compose up -d --build app db
```

ตอนเริ่ม container `app` จะรัน `prisma migrate deploy` ให้อัตโนมัติ แล้วจึงเริ่มเซิร์ฟเวอร์ที่พอร์ต 3000
รูปที่อัปโหลดเก็บใน volume `uploads` (`/data/uploads`) ส่วนฐานข้อมูลอยู่ใน volume `pgdata`

สร้างแอดมินคนแรกและหมวดหมู่เริ่มต้น (รันซ้ำได้ ไม่เขียนทับรหัสผ่านของแอดมินที่มีอยู่แล้ว):

```bash
docker compose exec app node seed.cjs
```

> `seed.cjs` คือ `prisma/seed.ts` ที่ bundle ไว้ตอน build image เพื่อไม่ต้องใส่ `tsx` ใน image
> (ถ้ารันนอก Docker ให้ใช้ `npm run seed`)

ตรวจว่าระบบทำงาน: `curl -I http://localhost:3000/login` ควรได้ `200`

อัปเดตเวอร์ชัน: `git pull && docker compose up -d --build app`

## ตั้ง cron แจ้งเตือนรายวัน

ระบบส่งเตือนรอบเดียวต่อวัน เมื่อเวลา Bangkok >= 08:00 (กันส่งซ้ำด้วย `ReminderLog`)
จึงตั้ง cron ให้เรียกทุกชั่วโมงได้อย่างปลอดภัย เช่นบนเครื่องเซิร์ฟเวอร์ (`crontab -e`):

```cron
0 * * * * curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/reminders
```

ใน crontab ต้องกำหนดค่า `CRON_SECRET` ไว้ก่อน (เช่นใส่บรรทัด `CRON_SECRET=...` ไว้เหนือคำสั่ง) หรือแทนค่าตรง ๆ

## ตั้งค่า LINE Official Account

1. สร้าง LINE Official Account และเปิดใช้ **Messaging API** ที่ LINE Developers Console
2. คัดลอก Channel secret และ Channel access token (long-lived) ใส่ `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`
3. ตั้ง Webhook URL เป็น `https://<host>/api/line/webhook` แล้วเปิด **Use webhook**
4. ใส่ลิงก์เพิ่มเพื่อนของ OA ใน `LINE_OA_ADD_FRIEND_URL`
5. ผู้ใช้เปิดหน้าโปรไฟล์ในเว็บเพื่อรับรหัส 6 หลัก (อายุ 10 นาที) แล้วส่งรหัสนั้นให้ LINE OA เพื่อผูกบัญชี

Webhook ต้องเป็น HTTPS ที่ใช้ได้จริง (ดูหัวข้อถัดไป)

## HTTPS ด้วย Caddy

คัดลอก `Caddyfile.example` เป็น `Caddyfile` แก้โดเมนให้เป็นของจริง แล้วติดตั้ง/รัน Caddy บนเครื่องเซิร์ฟเวอร์
(เปิดพอร์ต 80 และ 443 และชี้ DNS ของโดเมนมาที่เครื่องนี้) Caddy จะขอและต่ออายุใบรับรองให้อัตโนมัติ
แล้ว reverse proxy ไปที่ `localhost:3000` อย่าลืมตั้ง `APP_URL` เป็น `https://<โดเมน>`

## สำรองและกู้คืนข้อมูล

```bash
# สำรอง
docker compose exec -T db pg_dump -U postgres borrow > backup.sql

# กู้คืน: หยุดแอป -> ลบและสร้างฐานข้อมูลใหม่ -> กู้คืน -> เริ่มแอป
docker compose stop app
docker compose exec -T db psql -U postgres -d postgres -c 'DROP DATABASE borrow WITH (FORCE)'
docker compose exec -T db psql -U postgres -d postgres -c 'CREATE DATABASE borrow'
docker compose exec -T db psql -U postgres borrow < backup.sql
docker compose start app
```

คำเตือน: การกู้คืนจะลบข้อมูลปัจจุบันทั้งหมดของฐานข้อมูล `borrow`

อย่าลืมสำรองรูปที่อัปโหลดด้วย (volume `uploads`):

```bash
docker run --rm -v supply-dbt_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads.tgz -C /data .
```

(ชื่อ volume ขึ้นกับชื่อโฟลเดอร์โปรเจกต์ ตรวจด้วย `docker volume ls`)

## ความปลอดภัย

- เปลี่ยน `SEED_ADMIN_PASSWORD` ก่อน seed และเปลี่ยนรหัสผ่านแอดมินหลังเข้าสู่ระบบครั้งแรก
- ตั้ง `AUTH_SECRET` ด้วย `openssl rand -base64 32` และ `CRON_SECRET` เป็นค่าสุ่มที่เดายาก
- เปลี่ยน `POSTGRES_PASSWORD` (compose เปิดพอร์ตของ `db` และ `app` เฉพาะ `127.0.0.1` อยู่แล้ว ให้เข้าจากภายนอกผ่าน Caddy เท่านั้น)
- ห้าม commit ไฟล์ `.env`
- ใช้ HTTPS เสมอบน production
