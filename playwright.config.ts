import "dotenv/config";
import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";
import { assertTestDatabaseUrl } from "./tests/integration/dbGuard";

const PORT = 3200;
const BASE_URL = `http://localhost:${PORT}`;

// E2E runs only against the TEST database. The dev `borrow` database is never touched.
const testDbUrl = process.env.DATABASE_URL_TEST;
if (!testDbUrl) throw new Error("ต้องกำหนด DATABASE_URL_TEST ใน .env สำหรับ E2E");
// global-setup reads this; `next build` / `next start` get the URL via webServer.env below
assertTestDatabaseUrl(testDbUrl); // fail before `next build` starts if this is not a *_test database
process.env.E2E_DATABASE_URL = testDbUrl;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: BASE_URL, locale: "th-TH", timezoneId: "Asia/Bangkok", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    // Production build served by `next start`: the standalone server would need .next/static and public
    // copied next to it by hand, while `next start` serves the very same build as-is.
    command: `npm run build && npx next start -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 600_000,
    env: {
      DATABASE_URL: testDbUrl,
      AUTH_SECRET: "e2e-only-secret-not-for-production-use-0123456789",
      AUTH_TRUST_HOST: "true",
      APP_URL: BASE_URL,
      UPLOAD_DIR: path.join(os.tmpdir(), "borrow-e2e-uploads"),
    },
  },
});
