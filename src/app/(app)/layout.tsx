import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { navFor } from "@/components/nav";
import { MainNav } from "@/components/main-nav";
import { getCurrentUser } from "@/server/auth/session";
import { NotificationBell } from "@/components/notification-bell";
import { BrandLogo } from "@/components/brand-logo";
import { PageHelpBanner } from "@/components/page-help-banner";
import { ensureWired } from "@/server/wiring";

ensureWired();

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    // Suspended/removed users with a live JWT are signed out via a route
    // handler (cookies cannot be cleared while rendering a layout).
    redirect("/logout");
  }
  const items = navFor(user.role);

  return (
    <div className="min-h-dvh">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" aria-label="ระบบคลังวัสดุ แผนกเทคโนโลยีธุรกิจดิจิทัล หน้าแรก">
              <BrandLogo />
            </Link>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:inline">{user.name}</span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <Button type="submit" variant="outline" size="sm">
                  ออกจากระบบ
                </Button>
              </form>
            </div>
          </div>
          <MainNav items={items} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">
        <PageHelpBanner />
        {children}
      </main>
    </div>
  );
}
