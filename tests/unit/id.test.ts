import { expect, test } from "vitest";
import { parseId, requireId } from "@/lib/id";

test("parseId accepts positive integers from strings and numbers", () => {
  expect(parseId("1")).toBe(1);
  expect(parseId(" 42 ")).toBe(42);
  expect(parseId(7)).toBe(7);
});

test("parseId rejects anything that is not a positive integer id", () => {
  for (const v of ["", "0", "-1", "1.5", "abc", "cmhr8x2k00001", "1e3", "9".repeat(16), 0, -3, 2.5, NaN, null, undefined, {}]) {
    expect(parseId(v)).toBeNull();
  }
});

test("requireId throws a Thai error for bad ids", () => {
  expect(requireId("5")).toBe(5);
  expect(() => requireId("nope")).toThrow("ไม่พบข้อมูล");
});
