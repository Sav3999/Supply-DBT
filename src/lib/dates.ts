const TZ = "Asia/Bangkok";
const DAY_MS = 86_400_000;

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const hourFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  hourCycle: "h23",
});

/** วันที่ตามเวลาไทย เป็น Date ที่ 00:00 UTC (ตรงกับคอลัมน์ @db.Date) */
export function todayBangkok(now: Date = new Date()): Date {
  return parseDateOnly(dateFmt.format(now));
}

export function bangkokHour(now: Date = new Date()): number {
  return Number(hourFmt.format(now));
}

export function parseDateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function diffDaysInclusive(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}
