import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import { verifySignature } from "@/server/line/client";

describe("verifySignature", () => {
  test("verifies base64 HMAC-SHA256", () => {
    const sig = createHmac("sha256", "s").update("{}").digest("base64");
    expect(verifySignature("{}", sig, "s")).toBe(true);
    expect(verifySignature("{}", sig, "other")).toBe(false);
    expect(verifySignature("{}", "short", "s")).toBe(false);
    expect(verifySignature("{}", "", "s")).toBe(false);
  });
});
