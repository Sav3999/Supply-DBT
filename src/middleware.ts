import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

// Edge runtime: JWT only, no DB access. Server actions re-check roles.
const { auth } = NextAuth(authConfig);

const PUBLIC = [/^\/login$/, /^\/register$/, /^\/logout$/, /^\/api\/auth(\/|$)/, /^\/api\/line\/webhook$/, /^\/api\/cron(\/|$)/, /^\/uploads(\/|$)/];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => p.test(pathname))) return NextResponse.next();

  const user = req.auth?.user as { role?: string } | undefined;
  if (!user) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  const role = user.role;
  const isStaff = role === "STAFF" || role === "ADMIN";
  if (/^\/staff(\/|$)/.test(pathname) && !isStaff) return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  if (/^\/admin(\/|$)/.test(pathname) && role !== "ADMIN") return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
