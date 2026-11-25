import Link from "next/link";
import { requirePageRole } from "@/server/auth/session";

type Step = { text: string; href?: string; link?: string };
type Section = { id: string; title: string; who: string; steps: Step[] };

const BORROWER: Section = {
  id: "borrower",
  title: "สำหรับผู้ยืม",
  who: "นักเรียน นักศึกษา และครูที่ต้องการยืมวัสดุ",
  steps: [
    { text: "สมัครใช้งานด้วยอีเมล แล้วรอแอดมินยืนยันบัญชี (ยังล็อกอินไม่ได้จนกว่าจะได้รับการยืนยัน)" },
    { text: "ไปที่เมนู “รายการของ” เลือกของที่ต้องการ กดชื่อของแล้วใส่จำนวน กด “เพิ่มลงตะกร้า”", href: "/items", link: "รายการของ" },
    { text: "เปิด “ตะกร้า” เลือกวันยืม วันคืน ใส่เหตุผล แล้วกด “ส่งคำขอยืม”", href: "/cart", link: "ตะกร้า" },
    { text: "ติดตามสถานะที่เมนู “คำขอของฉัน” — รออนุมัติ → อนุมัติแล้ว → กำลังยืม → คืนแล้ว", href: "/my-loans", link: "คำขอของฉัน" },
    { text: "เมื่อสถานะเป็น “อนุมัติแล้ว” ให้ไปรับของกับเจ้าหน้าที่ตั้งแต่วันยืมที่เลือกไว้" },
    { text: "นำของมาคืนกับเจ้าหน้าที่ภายในวันกำหนดคืน (คืนทีละส่วนได้) ระบบจะเตือนล่วงหน้า 1 วัน และเตือนทุกวันถ้าเกินกำหนด" },
    { text: "ผูก LINE ที่หน้า “โปรไฟล์” เพื่อรับแจ้งเตือนในมือถือ: กด “ผูก LINE” → เพิ่มเพื่อน → พิมพ์รหัส 6 หลักในแชต", href: "/profile", link: "โปรไฟล์" },
    { text: "ยกเลิกคำขอได้ในหน้ารายละเอียดคำขอ ตอนที่ยังรออนุมัติหรืออนุมัติแล้วแต่ยังไม่รับของ" },
  ],
};

const STAFF: Section = {
  id: "staff",
  title: "สำหรับเจ้าหน้าที่",
  who: "ผู้ดูแลการยืม-คืนวัสดุของแผนก",
  steps: [
    { text: "เริ่มจาก “แดชบอร์ด” ดูจำนวนคำขอรออนุมัติ ต้องส่งมอบวันนี้ ครบกำหนดวันนี้ และเกินกำหนด", href: "/staff", link: "แดชบอร์ด" },
    { text: "เปิด “คำขอยืม” → กดรายการ → “อนุมัติ” หรือ “ปฏิเสธ” (ต้องใส่เหตุผล) ระบบจะไม่ให้อนุมัติถ้าของไม่พอ", href: "/staff/loans", link: "คำขอยืม" },
    { text: "เมื่อผู้ยืมมารับของ กด “ส่งมอบ” และเลือกเลขครุภัณฑ์ของชิ้นที่ให้ไป (ของที่นับจำนวนไม่ต้องเลือก)" },
    { text: "เมื่อผู้ยืมนำมาคืน กด “รับคืน” เลือกชิ้นหรือจำนวนที่คืน และสภาพ (ปกติ / ชำรุด / สูญหาย) — คืนครบแล้วสถานะจะเป็น “คืนแล้ว”" },
    { text: "เพิ่มหรือแก้ไขของที่ “จัดการของ” — ใส่จำนวน อัปโหลดรูป และเพิ่มเลขครุภัณฑ์ กด “แก้ไข” ท้ายแถวเพื่อเข้าไปแก้", href: "/staff/items", link: "จัดการของ" },
    { text: "ค้นหาประวัติการยืม-คืนและ “ส่งออก CSV” เพื่อเปิดใน Excel ที่เมนู “ประวัติ”", href: "/staff/history", link: "ประวัติ" },
  ],
};

const ADMIN: Section = {
  id: "admin",
  title: "สำหรับแอดมิน",
  who: "ผู้ดูแลระบบ",
  steps: [
    { text: "ยืนยันผู้สมัครใหม่ที่ “ผู้ใช้” → แท็บ “รอยืนยัน” (จะได้แจ้งเตือนเมื่อมีคนสมัคร)", href: "/admin/users", link: "ผู้ใช้" },
    { text: "ตั้งเจ้าหน้าที่: แท็บ “ผู้ใช้ทั้งหมด” → เปลี่ยนบทบาทเป็น “เจ้าหน้าที่” · ระงับบัญชีที่ไม่ใช้แล้วได้ที่หน้าเดียวกัน" },
    { text: "เพิ่มหรือแก้ไขหมวดหมู่ของที่ “หมวดหมู่”", href: "/admin/categories", link: "หมวดหมู่" },
    { text: "ตรวจสอบย้อนหลังว่าใครทำอะไรที่ “Audit Log”", href: "/admin/audit", link: "Audit Log" },
  ],
};

export default async function HelpPage() {
  const user = await requirePageRole("BORROWER", "STAFF", "ADMIN");
  const sections =
    user.role === "ADMIN" ? [BORROWER, STAFF, ADMIN] : user.role === "STAFF" ? [BORROWER, STAFF] : [BORROWER];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">วิธีใช้งาน</h1>
        <p className="text-sm text-muted-foreground">
          ขั้นตอนการใช้ระบบคลังวัสดุ ทีละขั้น กดชื่อเมนูสีน้ำเงินเพื่อไปยังหน้านั้นได้เลย
        </p>
      </div>

      {sections.length > 1 && (
        <nav aria-label="หัวข้อ" className="flex flex-wrap gap-2 text-sm">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-md border px-3 py-1 hover:bg-muted">
              {s.title}
            </a>
          ))}
        </nav>
      )}

      {sections.map((s) => (
        <section key={s.id} id={s.id} className="space-y-3 rounded-lg border p-4">
          <div>
            <h2 className="font-medium">{s.title}</h2>
            <p className="text-xs text-muted-foreground">{s.who}</p>
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {s.steps.map((step, i) => (
              <li key={i}>
                {step.text}
                {step.href && (
                  <>
                    {" "}
                    <Link href={step.href} className="whitespace-nowrap text-primary underline-offset-4 hover:underline">
                      ไปที่ {step.link} →
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section className="space-y-2 rounded-lg border p-4 text-sm">
        <h2 className="font-medium">ความหมายของสถานะคำขอ</h2>
        <ul className="space-y-1">
          <li><b>รออนุมัติ</b> — ส่งคำขอแล้ว รอเจ้าหน้าที่พิจารณา</li>
          <li><b>อนุมัติแล้ว</b> — มารับของได้ตั้งแต่วันยืม</li>
          <li><b>กำลังยืม</b> — รับของแล้ว ต้องคืนภายในวันกำหนดคืน</li>
          <li><b>คืนแล้ว</b> — คืนครบทุกรายการแล้ว</li>
          <li><b>ปฏิเสธ</b> — ไม่อนุมัติ ดูเหตุผลได้ในรายละเอียดคำขอ</li>
          <li><b>ยกเลิก</b> — ผู้ยืมหรือเจ้าหน้าที่ยกเลิกคำขอ</li>
        </ul>
      </section>
    </div>
  );
}
