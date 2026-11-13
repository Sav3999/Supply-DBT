import { describe, expect, it } from "vitest";
import { CONDITION_LABEL, LOAN_STATUS_LABEL, ROLE_LABEL } from "@/lib/labels";

describe("labels", () => {
  it("covers every condition and role with Thai text", () => {
    expect(CONDITION_LABEL).toEqual({ GOOD: "ปกติ", DAMAGED: "ชำรุด", LOST: "สูญหาย" });
    expect(ROLE_LABEL).toEqual({ BORROWER: "ผู้ยืม", STAFF: "เจ้าหน้าที่", ADMIN: "แอดมิน" });
  });
  it("has one loan-status map using the spec wording (REJECTED = ปฏิเสธ)", () => {
    expect(LOAN_STATUS_LABEL).toEqual({
      PENDING: "รออนุมัติ",
      APPROVED: "อนุมัติแล้ว",
      BORROWED: "กำลังยืม",
      RETURNED: "คืนแล้ว",
      REJECTED: "ปฏิเสธ",
      CANCELLED: "ยกเลิก",
    });
  });
});
