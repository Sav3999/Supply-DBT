import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { requirePageRole } from "@/server/auth/session";
import { listUsers } from "@/server/users";
import { activateAction, approveAction, rejectAction, setRoleAction, suspendAction } from "./actions";
import { ROLE_LABEL } from "@/lib/labels";
import { ActionButton, RoleSelect } from "./user-controls";

const STATUS_LABEL = { PENDING: "รอยืนยัน", ACTIVE: "ใช้งาน", SUSPENDED: "ถูกระงับ" } as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const actor = await requirePageRole("ADMIN");
  const { tab: tabParam, q } = await searchParams;
  const tab = tabParam === "all" ? "all" : "pending";
  const users = await listUsers(actor, tab === "pending" ? { status: "PENDING" } : { q });

  const tabClass = (active: boolean) =>
    cn("rounded-md px-3 py-1.5 text-sm", active ? "bg-primary text-primary-foreground" : "hover:bg-muted");

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">จัดการผู้ใช้</h1>
      <div className="flex gap-1">
        <Link href="/admin/users?tab=pending" className={tabClass(tab === "pending")}>
          รอยืนยัน
        </Link>
        <Link href="/admin/users?tab=all" className={tabClass(tab === "all")}>
          ผู้ใช้ทั้งหมด
        </Link>
      </div>

      {tab === "all" && (
        <form className="flex gap-2">
          <input type="hidden" name="tab" value="all" />
          <Input name="q" defaultValue={q ?? ""} placeholder="ค้นหาชื่อ อีเมล หรือแผนก" />
          <Button type="submit">ค้นหา</Button>
        </form>
      )}

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {tab === "pending" ? "ไม่มีผู้ใช้รอยืนยัน" : "ไม่พบผู้ใช้"}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ</TableHead>
                <TableHead>อีเมล</TableHead>
                <TableHead>แผนก</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>บทบาท</TableHead>
                <TableHead>การดำเนินการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.department}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        u.status === "ACTIVE" ? "default" : u.status === "PENDING" ? "secondary" : "destructive"
                      }
                    >
                      {STATUS_LABEL[u.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.status === "PENDING" || u.id === actor.id ? (
                      ROLE_LABEL[u.role]
                    ) : (
                      <RoleSelect action={setRoleAction} userId={u.id} role={u.role} />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {u.status === "PENDING" && (
                        <>
                          <ActionButton action={approveAction} userId={u.id} label="ยืนยัน" />
                          <ActionButton action={rejectAction} userId={u.id} label="ปฏิเสธ" variant="destructive" />
                        </>
                      )}
                      {u.status === "ACTIVE" && u.id !== actor.id && (
                        <ActionButton action={suspendAction} userId={u.id} label="ระงับ" variant="outline" />
                      )}
                      {u.status === "SUSPENDED" && (
                        <ActionButton action={activateAction} userId={u.id} label="เปิดใช้" variant="outline" />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
