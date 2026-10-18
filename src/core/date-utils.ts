export function todayISO(): string { return toISODate(new Date()); }
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(iso: string, days: number): string {
  const d = parseISO(iso); d.setDate(d.getDate() + days); return toISODate(d);
}
export function addMonths(iso: string, months: number): string {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toISODate(d);
}
export function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}
export function isSameOrBefore(a: string, b: string): boolean { return a <= b; }
export function diffDays(fromISO: string, toISO: string): number {
  return Math.round((parseISO(toISO).getTime() - parseISO(fromISO).getTime()) / 86400000);
}

/**
 * نخستین روز تجمیع (aggregationDay) که >= targetDate باشد.
 * اگر روز در ماه کوتاه نبود: last-day یا next-month-first.
 */
export function firstAggregationOnOrAfter(
  targetDate: string,
  aggregationDay: number,
  shortMonthRule: "last-day" | "next-month-first"
): string {
  const t = parseISO(targetDate);
  let y = t.getFullYear();
  let m = t.getMonth();

  for (let i = 0; i < 24; i++) {
    const dim = lastDayOfMonth(y, m);
    let candidate: string;
    if (aggregationDay <= dim) {
      candidate = toISODate(new Date(y, m, aggregationDay));
    } else if (shortMonthRule === "last-day") {
      candidate = toISODate(new Date(y, m, dim));
    } else {
      candidate = toISODate(new Date(y, m + 1, 1));
    }
    if (candidate >= targetDate) return candidate;
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return targetDate;
}
