import { describe, expect, test, vi } from "vitest";

// Importing the middleware pulls in next-auth; only `config` is needed here.
vi.mock("next-auth", () => ({ default: () => ({ auth: (fn: unknown) => fn }) }));
vi.mock("next/server", () => ({ NextResponse: {} }));

import { config } from "@/middleware";

// Next compiles each matcher with path-to-regexp; the single parenthesised
// group is a raw regex, so anchoring the whole pattern reproduces the semantics.
const re = new RegExp(`^${config.matcher[0]}$`);

describe("middleware matcher", () => {
  test.each(["/staff/loans/xpng", "/admin/users", "/items", "/login", "/staff/x.png/y"])("matches %s", (p) => {
    expect(re.test(p)).toBe(true);
  });
  test.each(["/logo.png", "/_next/static/x.js", "/_next/image", "/favicon.ico", "/a/b.svg"])("skips %s", (p) => {
    expect(re.test(p)).toBe(false);
  });
});
