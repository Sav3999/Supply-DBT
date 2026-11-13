import { describe, expect, it } from "vitest";
import { CONDITION_LABEL, ROLE_LABEL } from "@/lib/labels";

describe("labels", () => {
  it("covers every condition and role with Thai text", () => {
    expect(CONDITION_LABEL).toEqual({ GOOD: "ปกติ", DAMAGED: "ชำรุด", LOST: "สูญหาย" });
    expect(ROLE_LABEL).toEqual({ BORROWER: "ผู้ยืม", STAFF: "เจ้าหน้าที่", ADMIN: "แอดมิน" });
  });
});
