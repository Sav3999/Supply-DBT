import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePageRole } from "@/server/auth/session";
import { listAudit } from "@/server/reports";

export const dynamic = "force-dynamic";

const timeFmt = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Bangkok",
});

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requirePageRole("ADMIN");
  const action = (await searchParams).action?.trim() || undefined;
  const rows = await listAudit({ action, take: 200 });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">บันทึกการใช้งาน (Audit Log)</h1>
      <form className="flex gap-2">
        <Input name="action" defaultValue={action ?? ""} placeholder="กรองตาม action เช่น LOAN_APPROVE" />
        <Button type="submit" size="lg">
          กรอง
        </Button>
      </form>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">ไม่มีรายการ</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>เวลา</TableHead>
              <TableHead>ผู้ทำ</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>รหัส</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{timeFmt.format(r.createdAt)}</TableCell>
                <TableCell>{r.actorName ?? r.actorId}</TableCell>
                <TableCell>{r.action}</TableCell>
                <TableCell>{r.entity}</TableCell>
                <TableCell className="font-mono text-xs">{r.entityId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
