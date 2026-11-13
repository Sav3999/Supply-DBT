const PLACEHOLDERS = new Set(["change-me"]);
const MIN_LENGTH = 32;

/**
 * คืนข้อความ error ถ้า AUTH_SECRET ใช้ไม่ได้ใน production (ไม่มี, สั้นกว่า 32 ตัว, หรือยังเป็นค่าตัวอย่าง)
 * นอก production คืน null เสมอ
 */
export function authSecretProblem(env: { NODE_ENV?: string; AUTH_SECRET?: string }): string | null {
  if (env.NODE_ENV !== "production") return null;
  const secret = env.AUTH_SECRET ?? "";
  if (!secret) return "AUTH_SECRET ไม่ได้กำหนด: ตั้งค่าด้วย `openssl rand -base64 32` ก่อนเริ่มระบบ";
  if (PLACEHOLDERS.has(secret)) return "AUTH_SECRET ยังเป็นค่าตัวอย่าง (change-me): ตั้งค่าใหม่ด้วย `openssl rand -base64 32`";
  if (secret.length < MIN_LENGTH) return `AUTH_SECRET สั้นเกินไป (ต้องยาวอย่างน้อย ${MIN_LENGTH} ตัวอักษร): ตั้งค่าใหม่ด้วย \`openssl rand -base64 32\``;
  return null;
}

/** โยน error ถ้า AUTH_SECRET ใช้ไม่ได้ใน production — เรียกครั้งเดียวตอนเซิร์ฟเวอร์เริ่ม (instrumentation) */
export function assertAuthSecret(env: { NODE_ENV?: string; AUTH_SECRET?: string } = process.env): void {
  const problem = authSecretProblem(env);
  if (problem) throw new Error(problem);
}

/**
 * ใช้ใน instrumentation: ถ้า AUTH_SECRET ใช้ไม่ได้ใน production ให้พิมพ์เหตุผลแล้วจบ process
 * (การ throw ใน register() ทำให้ Next ยังเปิดพอร์ตแต่ตอบ 500 ทุกคำขอ — ไม่ใช่ "ไม่ยอมเริ่ม")
 */
export function exitOnBadAuthSecret(env: { NODE_ENV?: string; AUTH_SECRET?: string } = process.env): void {
  const problem = authSecretProblem(env);
  if (!problem) return;
  console.error(`[startup] ${problem}`);
  process.exit(1);
}
