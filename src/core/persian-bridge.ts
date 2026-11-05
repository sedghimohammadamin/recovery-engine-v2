import { App } from "obsidian";

// ============================================
// الگوریتم دقیق تبدیل تاریخ شمسی
// ============================================
function div(a: number, b: number) { return ~~(a / b); } // truncate
function mod(a: number, b: number) { return a - ~~(a / b) * b; }

function jalCal(jy: number) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let bl = breaks.length;
  let gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm, jump, leap, leapG, march, n, i;
  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div((jump % 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div((n % 33) + 3, 4);
  if ((jump % 33) === 4 && jump - n === 4) leapJ += 1;
  leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  leap = ((((n + 1) % 33) - 1) % 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number) {
  let j, i, gd, gm, gy;
  j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  i = div(mod(j, 1461), 4) * 5 + 308;
  gd = div(mod(i, 153), 5) + 1;
  gm = mod(div(i, 153), 12) + 1;
  gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number) {
  let gy = d2g(jdn).gy;
  let jy = gy - 621;
  let r = jalCal(jy);
  let jdn1f = g2d(gy, 3, r.march);
  let jd, jm, k;
  k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    } else {
      k -= 186;
    }
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

function gregorianToJalaliLocal(gy: number, gm: number, gd: number) { return d2j(g2d(gy, gm, gd)); }
function jalaliToGregorianLocal(jy: number, jm: number, jd: number) { return d2g(j2d(jy, jm, jd)); }

// ============================================
// API افزونه Persian Calendar
// ============================================
export interface PersianCalendarApi {
  gregorianToJalali: (gy: number, gm: number, gd: number) => { jy: number; jm: number; jd: number };
  jalaliToGregorian: (jy: number, jm: number, jd: number) => { gy: number; gm: number; gd: number };
  jalaliMonthName: (jm: number, lang?: string) => string;
}

export function getPersianCalendarApi(app: App): PersianCalendarApi | null {
  try {
    const plugins = (app as any).plugins;
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

export function toJalali(app: App, gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const api = getPersianCalendarApi(app);
  if (api) {
    try {
      const res: any = api.gregorianToJalali(gy, gm, gd);
      if (res) {
        const jy = Number(res.jy !== undefined ? res.jy : res.year);
        const jm = Number(res.jm !== undefined ? res.jm : res.month);
        const jd = Number(res.jd !== undefined ? res.jd : res.day);
        if (!isNaN(jy) && !isNaN(jm) && !isNaN(jd) && jm >= 1 && jm <= 12) return { jy, jm, jd };
      }
    } catch { /* ignore */ }
  }
  return gregorianToJalaliLocal(gy, gm, gd);
}

export function toGregorian(app: App, jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  const api = getPersianCalendarApi(app);
  if (api) {
    try {
      const res: any = api.jalaliToGregorian(jy, jm, jd);
      if (res) {
        const gy = Number(res.gy !== undefined ? res.gy : res.year);
        const gm = Number(res.gm !== undefined ? res.gm : res.month);
        const gd = Number(res.gd !== undefined ? res.gd : res.day);
        if (!isNaN(gy) && !isNaN(gm) && !isNaN(gd)) return { gy, gm, gd };
      }
    } catch { /* ignore */ }
  }
  return jalaliToGregorianLocal(jy, jm, jd);
}

export function jalaliMonthName(app: App, jm: number): string {
  const m = Number(jm);
  if (isNaN(m) || m < 1 || m > 12) return "?";
  const api = getPersianCalendarApi(app);
  if (api) {
    try {
      const name = api.jalaliMonthName(m);
      if (name && typeof name === "string" && name !== "undefined") return name;
    } catch { /* ignore */ }
  }
  const names = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
  return names[m - 1];
}

export function formatDateForDisplay(app: App, isoDate: string, dateFormat: "gregorian" | "jalali"): string {
  if (dateFormat !== "jalali") return isoDate;
  const [gy, gm, gd] = isoDate.split("-").map(Number);
  const j = toJalali(app, gy, gm, gd);
  return `${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`;
}

export function formatWithWeekday(app: App, isoDate: string, dateFormat: "gregorian" | "jalali"): string {
  const names = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
  const [gy, gm, gd] = isoDate.split("-").map(Number);
  const dt = new Date(gy, gm - 1, gd);
  const wd = names[dt.getDay()];
  return `${wd} ${formatDateForDisplay(app, isoDate, dateFormat)}`;
}

export function isoToJalaliString(app: App, isoDate: string): string {
  const [gy, gm, gd] = isoDate.split("-").map(Number);
  const j = toJalali(app, gy, gm, gd);
  return `${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`;
}

export function jalaliStringToIso(app: App, jalaliStr: string): string | null {
  const parts = jalaliStr.trim().split(/[\/\-]/).map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [jy, jm, jd] = parts;
  const g = toGregorian(app, jy, jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
}

// --- توابع خالص (بدون نیاز به app) برای استفاده در scheduler ---
export function pureGregorianToJalali(gy: number, gm: number, gd: number) {
  return gregorianToJalaliLocal(gy, gm, gd);
}
export function pureJalaliToGregorian(jy: number, jm: number, jd: number) {
  return jalaliToGregorianLocal(jy, jm, jd);
}
