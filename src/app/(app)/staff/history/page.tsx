import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/db";
import { formatDateOnly, formatThaiDate } from "@/lib/dates";
import { requirePageRole } from "@/server/auth/session";
import { LOAN_STATUS_LABEL } from "@/lib/labels";
import { parseHistoryFilter, searchHistory } from "@/server/reports";

export const dynamic = "force-dynamic";

const selectClass =
  "h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function StaffHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePageRole("STAFF");
  const params = await searchParams;
  const filter = parseHistoryFilter(params);
  const [rows, items] = await Promise.all([
    searchHistory(filter),
    prisma.item.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const qs = new URLSearchParams();
  if (filter.borrowerQ) qs.set("borrower", filter.borrowerQ);
  if (filter.itemId) qs.set("itemId", filter.itemId);
  if (filter.from) qs.set("from", formatDateOnly(filter.from));
  if (filter.to) qs.set("to", formatDateOnly(filter.to));
  if (filter.status) qs.set("status", filter.status);
  const csvHref = `/api/staff/history.csv${qs.size ? `?${qs}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">ประวัติการยืม</h1>
        <a
          href={csvHref}
          download
          className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
        >
          ส่งออก CSV
        </a>
      </div>
      <form className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label htmlFor="borrower">ผู้ยืม</Label>
          <Input id="borrower" name="borrower" defaultValue={filter.borrowerQ ?? ""} placeholder="ชื่อผู้ยืม" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="itemId">ของ</Label>
          <select id="itemId" name="itemId" defaultValue={filter.itemId ?? ""} className={selectClass}>
            <option value="">ทั้งหมด</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="from">ตั้งแต่วันที่</Label>
          <Input id="from" type="date" name="from" defaultValue={filter.from ? formatDateOnly(filter.from) : ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">ถึงวันที่</Label>
          <Input id="to" type="date" name="to" defaultValue={filter.to ? formatDateOnly(filter.to) : ""} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="status">สถานะ</Label>
          <select id="status" name="status" defaultValue={filter.status ?? ""} className={selectClass}>
            <option value="">ทั้งหมด</option>
            {Object.entries(LOAN_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-5">
          <Button type="submit" size="lg">
            ค้นหา
          </Button>
        </div>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">ไม่พบรายการ</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ผู้ยืม</TableHead>
              <TableHead>หน่วยงาน</TableHead>
              <TableHead>รายการ</TableHead>
              <TableHead>วันยืม</TableHead>
              <TableHead>กำหนดคืน</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>วันที่คืน</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.loanId}>
                <TableCell>{r.borrowerName}</TableCell>
                <TableCell>{r.department}</TableCell>
                <TableCell className="min-w-48 whitespace-normal">{r.items}</TableCell>
                <TableCell>{formatThaiDate(r.startDate)}</TableCell>
                <TableCell>{formatThaiDate(r.dueDate)}</TableCell>
                <TableCell>{LOAN_STATUS_LABEL[r.status]}</TableCell>
                <TableCell>{r.returnedAt ? formatThaiDate(r.returnedAt) : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
