import { App } from "obsidian";

export interface PersianCalendarApi {
  gregorianToJalali: (gy: number, gm: number, gd: number) => { jy: number; jm: number; jd: number };
  jalaliToGregorian: (jy: number, jm: number, jd: number) => { gy: number; gm: number; gd: number };
  jalaliMonthName: (jm: number, lang?: string) => string;
}

export function getPersianCalendarApi(app: App): PersianCalendarApi | null {
  try {
    const plugins = (app as unknown).plugins;
    if (!plugins?.getPlugin) return null;
    const pc = plugins.getPlugin("persian-calendar");
    const api = pc?.api;
    if (typeof api?.gregorianToJalali === "function") return api as PersianCalendarApi;
    return null;
  } catch { return null; }
}

export function hasPersianCalendar(app: App): boolean {
  return getPersianCalendarApi(app) !== null;
}

export function formatDateForDisplay(
  app: App, isoDate: string, dateFormat: "gregorian" | "jalali"
): string {
  if (dateFormat !== "jalali") return isoDate;
  const api = getPersianCalendarApi(app);
  if (!api) return isoDate;
  const [gy, gm, gd] = isoDate.split("-").map(Number);
  try {
    const { jy, jm, jd } = api.gregorianToJalali(gy, gm, gd);
    return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
  } catch { return isoDate; }
}

/** تاریخ شمسی (رشته YYYY-MM-DD) را به ISO میلادی تبدیل می‌کند */
export function jalaliStringToIso(app: App, jalaliStr: string): string | null {
  const api = getPersianCalendarApi(app);
  if (!api) return null;
  const parts = jalaliStr.trim().split(/[\/\-]/).map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [jy, jm, jd] = parts;
  try {
    const { gy, gm, gd } = api.jalaliToGregorian(jy, jm, jd);
    return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
  } catch { return null; }
}

/** ISO میلادی را به رشته شمسی برای input تبدیل می‌کند */
export function isoToJalaliString(app: App, isoDate: string): string {
  const api = getPersianCalendarApi(app);
  if (!api) return isoDate;
  const [gy, gm, gd] = isoDate.split("-").map(Number);
  try {
    const { jy, jm, jd } = api.gregorianToJalali(gy, gm, gd);
    return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
  } catch { return isoDate; }
}

/** نام روز هفته (شمسی) بر اساس تاریخ ISO میلادی. شنبه=6، یکشنبه=0 ... جمعه=5 */
export function jalaliWeekdayName(isoDate: string): string {
  const names = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return names[dt.getDay()];
}

/** "شنبه 1405/07/25" — هم نام روز هم تاریخ شمسی (اگر Persian Calendar نصب باشد) */
export function formatWithWeekday(
  app: unknown,
  isoDate: string,
  dateFormat: "gregorian" | "jalali"
): string {
  const wd = jalaliWeekdayName(isoDate);
  const dateStr = formatDateForDisplay(app, isoDate, dateFormat);
  return `${wd} ${dateStr}`;
}
