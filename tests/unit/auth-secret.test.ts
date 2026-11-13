import { describe, expect, test } from "vitest";
import { assertAuthSecret, authSecretProblem } from "@/lib/auth-secret";

const GOOD = "a".repeat(32);

describe("authSecretProblem", () => {
  test("ignored outside production", () => {
    expect(authSecretProblem({ NODE_ENV: "development" })).toBeNull();
    expect(authSecretProblem({ NODE_ENV: "test", AUTH_SECRET: "change-me" })).toBeNull();
  });
  test("production rejects missing, placeholder and short secrets", () => {
    expect(authSecretProblem({ NODE_ENV: "production" })).toMatch(/ไม่ได้กำหนด/);
    expect(authSecretProblem({ NODE_ENV: "production", AUTH_SECRET: "" })).toMatch(/ไม่ได้กำหนด/);
    expect(authSecretProblem({ NODE_ENV: "production", AUTH_SECRET: "change-me" })).toMatch(/change-me/);
    expect(authSecretProblem({ NODE_ENV: "production", AUTH_SECRET: "a".repeat(31) })).toMatch(/32/);
  });
  test("production accepts a 32+ char secret", () => {
    expect(authSecretProblem({ NODE_ENV: "production", AUTH_SECRET: GOOD })).toBeNull();
  });
  test("assertAuthSecret throws with the message", () => {
    expect(() => assertAuthSecret({ NODE_ENV: "production", AUTH_SECRET: "change-me" })).toThrow(/AUTH_SECRET/);
    expect(() => assertAuthSecret({ NODE_ENV: "production", AUTH_SECRET: GOOD })).not.toThrow();
  });
});
