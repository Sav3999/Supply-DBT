"use server";

import { ensureWired } from "@/server/wiring";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { toResult, type Result } from "@/lib/result";
import { registerUser } from "@/server/auth/register";

export type LoginState = { error?: string } | undefined;

const THAI = /[฀-๿]/;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
  } catch (e) {
    // Success redirects by throwing; only AuthError is ours to handle.
    if (e instanceof AuthError) {
      // The Thai message travels in `code`; the default code is English ("credentials").
      const code = (e as { code?: string }).code;
      return { error: code && THAI.test(code) ? code : "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
    }
    throw e;
  }
}

export type RegisterState = Result<null> | undefined;

export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  return toResult(async () => {
    await registerUser({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      department: formData.get("department"),
      phone: formData.get("phone"),
    });
    return null;
  });
}

ensureWired();
