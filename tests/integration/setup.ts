import "dotenv/config";
import { execSync } from "node:child_process";

export default function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST is not set");
  // NOTE: `migrate deploy` does not apply edits to existing migrations; reset borrow_test manually if the schema drifts.
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url },
  });
}
