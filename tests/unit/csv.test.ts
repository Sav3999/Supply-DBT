import { expect, test } from "vitest";
import { parseDateOnly as d } from "@/lib/dates";
import { historyToCsv, parseHistoryFilter } from "@/server/reports";

test("csv has BOM, Thai header, escapes", () => {
  const csv = historyToCsv([
    {
      loanId: "L1",
      borrowerName: 'ก "ข"',
      department: "IT, ฝ่าย",
      items: "จอบ x3",
      startDate: d("2026-11-09"),
      dueDate: d("2026-11-12"),
      status: "BORROWED",
      returnedAt: null,
    },
  ]);
  expect(csv.startsWith("﻿เลขที่,ผู้ยืม,หน่วยงาน,รายการ,วันยืม,กำหนดคืน,สถานะ,วันที่คืน\r\n")).toBe(true);
  expect(csv).toContain('L1,"ก ""ข""","IT, ฝ่าย",จอบ x3,2026-11-09,2026-11-12,กำลังยืม,');
});

test("csv quotes newlines and formats returned date in Bangkok", () => {
  const csv = historyToCsv([
    {
      loanId: "L2",
      borrowerName: "a\nb",
      department: "x",
      items: "y",
      startDate: d("2026-11-09"),
      dueDate: d("2026-11-12"),
      status: "RETURNED",
      returnedAt: new Date("2026-11-11T18:00:00Z"), // 01:00 on 12th in Bangkok
    },
  ]);
  expect(csv).toContain('L2,"a\nb",x,y,2026-11-09,2026-11-12,คืนแล้ว,2026-11-12');
});

test("parseHistoryFilter ignores invalid values", () => {
  const f = parseHistoryFilter({ borrower: " สม ", from: "2026-11-01", to: "bad", status: "NOPE", itemId: "" });
  expect(f.borrowerQ).toBe("สม");
  expect(f.from).toEqual(d("2026-11-01"));
  expect(f.to).toBeUndefined();
  expect(f.status).toBeUndefined();
  expect(f.itemId).toBeUndefined();
  expect(parseHistoryFilter(new URLSearchParams("status=RETURNED&to=2026-02-30")).status).toBe("RETURNED");
  expect(parseHistoryFilter(new URLSearchParams("to=2026-02-30")).to).toBeUndefined();
});

test("csv neutralises spreadsheet formulas in text cells only", () => {
  const row = {
    loanId: "L3",
    borrowerName: '=HYPERLINK("x")',
    department: "-5",
    items: "@cmd",
    startDate: d("2026-11-09"),
    dueDate: d("2026-11-12"),
    status: "BORROWED" as const,
    returnedAt: null,
  };
  const csv = historyToCsv([row]);
  expect(csv).toContain(`L3,"'=HYPERLINK(""x"")",'-5,'@cmd,2026-11-09,2026-11-12,`);
  expect(historyToCsv([{ ...row, borrowerName: "\tx", department: "+1", items: "ok" }])).toContain(`L3,'\tx,'+1,ok,`);
});
