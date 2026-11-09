import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  CRON_SECRET: z.string().default(""),
  APP_URL: z.string().default("http://localhost:3000"),
  LINE_CHANNEL_SECRET: z.string().default(""),
  LINE_CHANNEL_ACCESS_TOKEN: z.string().default(""),
  LINE_OA_ADD_FRIEND_URL: z.string().default(""),
  UPLOAD_DIR: z.string().default("/data/uploads"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** อ่านและตรวจตัวแปรสภาพแวดล้อมเมื่อเรียกใช้ (ไม่ตรวจตอน import) */
export function getEnv(): Env {
  return (cached ??= schema.parse(process.env));
}
