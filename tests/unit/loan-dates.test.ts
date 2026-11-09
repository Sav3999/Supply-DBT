import { expect, test } from "vitest";
import { parseDateOnly as d } from "@/lib/dates";
import { validateLoanDates } from "@/server/loans/dates";
import { isOverdue } from "@/server/loans/status";

const today = d("2026-11-09");

test.each([
  [d("2026-11-08"), d("2026-11-10"), [7], "วันยืมต้องไม่ก่อนวันนี้"],
  [d("2026-11-10"), d("2026-11-09"), [7], "วันคืนต้องไม่ก่อนวันยืม"],
  [d("2026-11-09"), d("2026-11-16"), [7, 14], "ยืมได้ไม่เกิน 7 วัน"],
  [d("2026-11-09"), d("2026-11-15"), [7], null],
])("validateLoanDates %#", (s, e, m, want) => {
  expect(validateLoanDates(s, e, m, today)).toBe(want);
});

test("validateLoanDates with no items has no max", () => {
  expect(validateLoanDates(d("2026-11-09"), d("2027-11-09"), [], today)).toBeNull();
});

test("isOverdue", () => {
  expect(isOverdue({ status: "BORROWED", dueDate: d("2026-11-08") }, today)).toBe(true);
  expect(isOverdue({ status: "BORROWED", dueDate: d("2026-11-09") }, today)).toBe(false);
  expect(isOverdue({ status: "RETURNED", dueDate: d("2026-11-01") }, today)).toBe(false);
});
