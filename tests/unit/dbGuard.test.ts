import { expect, test } from "vitest";
import { assertTestDatabaseUrl } from "../integration/dbGuard";

test("accepts *_test database", () => {
  expect(() => assertTestDatabaseUrl("postgresql://u:p@localhost:5432/borrow_test")).not.toThrow();
  expect(() => assertTestDatabaseUrl("postgresql://u:p@localhost:5432/borrow_test?schema=public")).not.toThrow();
});
test("refuses non-test, empty or invalid URLs", () => {
  expect(() => assertTestDatabaseUrl("postgresql://u:p@localhost:5432/borrow")).toThrow();
  expect(() => assertTestDatabaseUrl("postgresql://u:p@localhost:5432/")).toThrow();
  expect(() => assertTestDatabaseUrl(undefined)).toThrow();
  expect(() => assertTestDatabaseUrl("not a url")).toThrow();
});
