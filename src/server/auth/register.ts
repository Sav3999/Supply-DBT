import { Prisma, type User } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/result";
import { hashPassword } from "./password";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  email: z.string().trim().toLowerCase().pipe(z.email("อีเมลไม่ถูกต้อง")),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
  department: z.string().trim().min(1, "กรุณากรอกหน่วยงาน"),
  phone: z.string().trim().min(1, "กรุณากรอกเบอร์โทร"),
});

type UserRegisteredHandler = (user: User) => Promise<void>;
let onUserRegistered: UserRegisteredHandler = async () => {};

export function setUserRegisteredHandler(fn: UserRegisteredHandler): void {
  onUserRegistered = fn;
}

export async function registerUser(input: unknown): Promise<User> {
  const data = registerSchema.parse(input);
  const passwordHash = await hashPassword(data.password);
  let user: User;
  try {
    user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        department: data.department,
        phone: data.phone,
        role: "BORROWER",
        status: "PENDING",
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AppError("อีเมลนี้ถูกใช้แล้ว");
    }
    throw e;
  }
  try {
    await onUserRegistered(user);
  } catch (e) {
    console.error("onUserRegistered hook failed", e); // must not fail registration
  }
  return user;
}
