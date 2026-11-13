// Runs once when the server process starts (not in the edge middleware).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // `next build` sets NODE_ENV=production but must not need the real secret.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertAuthSecret } = await import("@/lib/auth-secret");
  assertAuthSecret();
}
