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

describe("exitOnBadAuthSecret", () => {
  test("exits the process with code 1 on a bad production secret, otherwise no-op", async () => {
    const { vi } = await import("vitest");
    const { exitOnBadAuthSecret } = await import("@/lib/auth-secret");
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    exitOnBadAuthSecret({ NODE_ENV: "production", AUTH_SECRET: GOOD });
    expect(exit).not.toHaveBeenCalled();
    exitOnBadAuthSecret({ NODE_ENV: "production", AUTH_SECRET: "change-me" });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls[0][0]).toMatch(/AUTH_SECRET/);
    exit.mockRestore();
    err.mockRestore();
  });
});
