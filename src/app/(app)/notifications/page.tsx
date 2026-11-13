import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requirePageRole } from "@/server/auth/session";
import { listNotifications } from "@/server/notifications";
import { markAllReadAction } from "./actions";

const fmt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

export default async function NotificationsPage() {
  const user = await requirePageRole("BORROWER", "STAFF", "ADMIN");
  const items = await listNotifications(user.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">การแจ้งเตือน</h1>
        {items.some((n) => !n.readAt) && (
          <form action={markAllReadAction}>
            <Button type="submit" variant="outline" size="sm">
              อ่านทั้งหมด
            </Button>
          </form>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const body = (
              <>
                <p className={n.readAt ? "text-sm" : "text-sm font-semibold"}>{n.message}</p>
                <p className="text-xs text-muted-foreground">{fmt.format(n.createdAt)}</p>
              </>
            );
            return (
              <li key={n.id} className="rounded-lg border p-3">
                {n.link ? (
                  <Link href={n.link} className="block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
