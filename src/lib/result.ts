import { ZodError } from "zod";

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function toResult<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message };
    if (e instanceof ZodError) {
      return { ok: false, error: e.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
    }
    throw e;
  }
}
