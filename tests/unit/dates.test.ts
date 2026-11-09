import { test, expect } from "vitest";
import { todayBangkok, bangkokHour, diffDaysInclusive, parseDateOnly, formatDateOnly, addDays } from "@/lib/dates";

test("todayBangkok near midnight", () => {
  expect(formatDateOnly(todayBangkok(new Date("2026-11-09T16:30:00Z")))).toBe("2026-11-09"); // 23:30 ไทย
  expect(formatDateOnly(todayBangkok(new Date("2026-11-09T17:00:00Z")))).toBe("2026-11-10"); // 00:00 ไทย
});
test("bangkokHour", () => expect(bangkokHour(new Date("2026-11-09T01:00:00Z"))).toBe(8));
test("diffDaysInclusive", () => expect(diffDaysInclusive(parseDateOnly("2026-11-10"), parseDateOnly("2026-11-14"))).toBe(5));
test("addDays and parse/format roundtrip", () => {
  expect(formatDateOnly(addDays(parseDateOnly("2026-11-30"), 2))).toBe("2026-12-02");
  expect(parseDateOnly("2026-11-09").toISOString()).toBe("2026-11-09T00:00:00.000Z");
});
