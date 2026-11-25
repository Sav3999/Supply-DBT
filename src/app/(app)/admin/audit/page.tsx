import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AUDIT_ACTION_LABEL, auditActionLabel, auditEntityLabel } from "@/lib/labels";
import { requirePageRole } from "@/server/auth/session";
import { listAudit } from "@/server/reports";

export const dynamic = "force-dynamic";

const timeFmt = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Asia/Bangkok",
});

const selectClass =
  "h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-xs";

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  await requirePageRole("ADMIN");
  const action = (await searchParams).action?.trim() || undefined;
  const rows = await listAudit({ action, take: 200 });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">บันทึกการใช้งาน</h1>
      <form className="flex gap-2">
        <label htmlFor="action" className="sr-only">
          การกระทำ
        </label>
        <select id="action" name="action" defaultValue={action ?? ""} className={selectClass}>
          <option value="">ทุกการกระทำ</option>
          {Object.entries(AUDIT_ACTION_LABEL).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
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
              <TableHead>การกระทำ</TableHead>
              <TableHead>เกี่ยวกับ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{timeFmt.format(r.createdAt)}</TableCell>
                <TableCell>{r.actorName ?? `ผู้ใช้ #${r.actorId} (ถูกลบแล้ว)`}</TableCell>
                <TableCell>{auditActionLabel(r.action)}</TableCell>
                <TableCell>
                  {auditEntityLabel(r.entity)} #{r.entityId}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
