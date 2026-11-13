import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

// Edge runtime: JWT only, no DB access. Only checks "logged in".
const { auth } = NextAuth(authConfig);

const PUBLIC = [/^\/login$/, /^\/register$/, /^\/logout$/, /^\/api\/auth(\/|$)/, /^\/api\/line\/webhook$/, /^\/api\/cron(\/|$)/, /^\/uploads(\/|$)/];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => p.test(pathname))) return NextResponse.next();

  const user = req.auth?.user;
  if (!user) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  // Role checks happen in pages (requirePageRole) and server actions (requireRole)
  // against the DB role: the JWT role is only set at sign-in and goes stale.
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
