import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    // session.ts imports @/auth -> next-auth, whose ESM fails to resolve "next/server" unless inlined.
    server: { deps: { inline: ["next-auth"] } },
    testTimeout: 20000,
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["./tests/integration/setup.ts"],
          setupFiles: ["./tests/integration/env.ts"],
          hookTimeout: 120000,
        },
      },
    ],
  },
});
