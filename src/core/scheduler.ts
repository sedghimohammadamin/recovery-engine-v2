import { ReviewSession, ScheduleSettings } from "../models/review-item";
import { addDays, parseISO, toISODate } from "./date-utils";
import { pureGregorianToJalali, pureJalaliToGregorian } from "./persian-bridge";

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

function addJalaliMonths(iso: string, months: number): string {
  const [gy, gm, gd] = iso.split("-").map(Number);
  const j = pureGregorianToJalali(gy, gm, gd);
  let jy = j.jy;
  let jm = j.jm + months;
  let jd = j.jd;

  while (jm > 12) { jm -= 12; jy += 1; }
  while (jm < 1) { jm += 12; jy -= 1; }

  const maxDays = jm <= 6 ? 31 : (jm <= 11 ? 30 : 29);
  if (jd > maxDays) jd = maxDays;

  const g = pureJalaliToGregorian(jy, jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
}

function firstJalaliAggregationOnOrAfter(iso: string, aggDay: number, shortMonthRule: string): string {
  const [gy, gm, gd] = iso.split("-").map(Number);
  const j = pureGregorianToJalali(gy, gm, gd);
  let jy = j.jy;
  let jm = j.jm;
  let targetDay = aggDay;

  const maxDaysThisMonth = jm <= 6 ? 31 : (jm <= 11 ? 30 : 29);
  if (targetDay > maxDaysThisMonth) {
    if (shortMonthRule === "last-day") {
      targetDay = maxDaysThisMonth;
    } else {
      targetDay = 1;
      jm += 1;
      if (jm > 12) { jm = 1; jy += 1; }
    }
  }

  let g = pureJalaliToGregorian(jy, jm, targetDay);
  let candidate = `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;

  if (candidate >= iso) return candidate;

  // اگر تاریخ گذشت، برو ماه بعد
  jm += 1;
  if (jm > 12) { jm = 1; jy += 1; }

  const maxDaysNextMonth = jm <= 6 ? 31 : (jm <= 11 ? 30 : 29);
  targetDay = aggDay;
  if (targetDay > maxDaysNextMonth) {
    if (shortMonthRule === "last-day") {
      targetDay = maxDaysNextMonth;
    } else {
      targetDay = 1;
      jm += 1;
      if (jm > 12) { jm = 1; jy += 1; }
    }
  }

  g = pureJalaliToGregorian(jy, jm, targetDay);
  return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
}

function upcomingWeekdayDatesAfter(startDate: string, weekdays: number[], count: number): string[] {
  if (weekdays.length === 0 || count <= 0) return [];
  const jsDays = new Set(weekdays.map((d) => (d + 6) % 7));
  const result: string[] = [];
  const cursor = parseISO(startDate);
  let guard = 0;
  while (result.length < count && guard < 800) {
    cursor.setDate(cursor.getDate() + 1);
    if (jsDays.has(cursor.getDay())) result.push(toISODate(cursor));
    guard++;
  }
  return result;
}

export function buildSchedule(learnedAt: string, settings: ScheduleSettings): ReviewSession[] {
  const reviews: ReviewSession[] = [];
  let lastDueDate = learnedAt;

  if (settings.initial.enabled) {
    const n = Math.max(0, settings.initial.count);
    for (let i = 0; i < n; i++) {
      const off = settings.initial.offsets[i] ?? i;
      const due = addDays(learnedAt, off);
      reviews.push({
        id: uid("rev"), kind: "initial", label: `مرور اولیهٔ ${i + 1}`,
        baseDate: learnedAt, dueDate: due, completed: false, completedAt: null, notes: "",
      });
      if (due > lastDueDate) lastDueDate = due;
    }
  }

  if (settings.weekend.enabled) {
    const dates = upcomingWeekdayDatesAfter(lastDueDate, settings.weekend.weekdays, settings.weekend.count);
    dates.forEach((d, i) => {
      reviews.push({
        id: uid("rev"), kind: "weekend", label: `مرور آخر هفتهٔ ${i + 1}`,
        baseDate: learnedAt, dueDate: d, completed: false, completedAt: null, notes: "",
      });
      if (d > lastDueDate) lastDueDate = d;
    });
  }

  if (settings.monthly.enabled) {
    const n = Math.max(0, settings.monthly.count);
    const aggDay = settings.monthly.aggregationDay || 25;
    for (let i = 0; i < n; i++) {
      const months = settings.monthly.offsetsMonths[i] ?? i;
      const actualDue = addJalaliMonths(learnedAt, months);
      let due = firstJalaliAggregationOnOrAfter(actualDue, aggDay, settings.monthly.shortMonthRule);
      if (due <= lastDueDate) {
        due = firstJalaliAggregationOnOrAfter(addDays(lastDueDate, 1), aggDay, settings.monthly.shortMonthRule);
      }
      reviews.push({
        id: uid("rev"), kind: "monthly", label: `مرور ${months === 0 ? "همان" : months} ماهه`,
        baseDate: learnedAt, dueDate: due, completed: false, completedAt: null, notes: "",
      });
      if (due > lastDueDate) lastDueDate = due;
    }
  }

  if (settings.longterm.enabled) {
    const n = Math.max(0, settings.longterm.count);
    const aggDay = settings.longterm.useOwnAggregation ? settings.longterm.aggregationDay : (settings.monthly.aggregationDay || 25);
    for (let i = 0; i < n; i++) {
      const months = settings.longterm.offsetsMonths[i] ?? 6;
      const actualDue = addJalaliMonths(learnedAt, months);
      let due = firstJalaliAggregationOnOrAfter(actualDue, aggDay, settings.monthly.shortMonthRule);
      if (due <= lastDueDate) {
        due = firstJalaliAggregationOnOrAfter(addDays(lastDueDate, 1), aggDay, settings.monthly.shortMonthRule);
      }
      reviews.push({
        id: uid("rev"), kind: "longterm", label: `مرور ${months} ماهه (بلندمدت)`,
        baseDate: learnedAt, dueDate: due, completed: false, completedAt: null, notes: "",
      });
      if (due > lastDueDate) lastDueDate = due;
    }
  }

  return reviews;
}
