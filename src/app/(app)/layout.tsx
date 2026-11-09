import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { navFor } from "@/components/nav";
import { getCurrentUser } from "@/server/auth/session";

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
            <Link href="/" className="font-semibold">
              ระบบยืม-คืนของ
            </Link>
            <div className="flex items-center gap-2">
              <span className="truncate text-sm text-muted-foreground">{user.name}</span>
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
          <nav className="flex gap-1 overflow-x-auto pb-1">
            {items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className="rounded-md px-3 py-1.5 text-sm whitespace-nowrap hover:bg-muted"
              >
                {i.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
