import { test, expect } from "vitest";
import { z } from "zod";
import { AppError, toResult } from "@/lib/result";

test("toResult maps AppError", async () => {
  expect(await toResult(async () => { throw new AppError("x"); })).toEqual({ ok: false, error: "x" });
  expect(await toResult(async () => 1)).toEqual({ ok: true, data: 1 });
});
test("toResult maps ZodError to first message", async () => {
  const r = await toResult(async () => z.string().min(3, "สั้นเกินไป").parse("a"));
  expect(r).toEqual({ ok: false, error: "สั้นเกินไป" });
});
test("toResult rethrows unknown", async () => {
  await expect(toResult(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
});
