import { ReviewSession, ScheduleSettings } from "../models/review-item";
import { addDays, addMonths, firstAggregationOnOrAfter, parseISO, toISODate } from "./date-utils";

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * weekdays با شنبه=0، یکشنبه=1، ...، جمعه=6 (مطابق تنظیمات UI).
 * getDay() جاوااسکریپت: یکشنبه=0، دوشنبه=1، ...، شنبه=6.
 * نگاشت: (d + 6) % 7
 *   شنبه(0) → 6 ✓
 *   یکشنبه(1) → 0 ✓
 *   جمعه(6) → 5 ✓
 */
function upcomingWeekdayDates(learnedAt: string, weekdays: number[], count: number): string[] {
  if (weekdays.length === 0 || count <= 0) return [];
  const jsDays = new Set(weekdays.map((d) => (d + 6) % 7));
  const result: string[] = [];
  const cursor = parseISO(learnedAt);
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

  if (settings.initial.enabled) {
    const n = Math.max(0, settings.initial.count);
    for (let i = 0; i < n; i++) {
      const off = settings.initial.offsets[i] ?? i;
      const base = settings.countLearningDayAsFirst ? learnedAt : addDays(learnedAt, 1);
      const due = addDays(base, off);
      if (!settings.countLearningDayAsFirst && due <= learnedAt) continue;
      reviews.push({
        id: uid("rev"), kind: "initial", label: `مرور اولیهٔ ${i + 1}`,
        baseDate: learnedAt, dueDate: due,
        completed: false, completedAt: null, notes: "",
      });
    }
  }

  if (settings.weekend.enabled) {
    const dates = upcomingWeekdayDates(learnedAt, settings.weekend.weekdays, settings.weekend.count);
    dates.forEach((d, i) => {
      reviews.push({
        id: uid("rev"), kind: "weekend", label: `مرور آخر هفتهٔ ${i + 1}`,
        baseDate: learnedAt, dueDate: d,
        completed: false, completedAt: null, notes: "",
      });
    });
  }

  if (settings.monthly.enabled) {
    const n = Math.max(0, settings.monthly.count);
    for (let i = 0; i < n; i++) {
      const months = settings.monthly.offsetsMonths[i] ?? i + 1;
      const actualDue = addMonths(learnedAt, months);
      const due = firstAggregationOnOrAfter(actualDue, settings.monthly.aggregationDay, settings.monthly.shortMonthRule);
      reviews.push({
        id: uid("rev"), kind: "monthly", label: `مرور ${months} ماهه`,
        baseDate: learnedAt, dueDate: due,
        completed: false, completedAt: null, notes: "",
      });
    }
  }

  if (settings.longterm.enabled) {
    const n = Math.max(0, settings.longterm.count);
    const aggDay = settings.longterm.useOwnAggregation ? settings.longterm.aggregationDay : settings.monthly.aggregationDay;
    for (let i = 0; i < n; i++) {
      const months = settings.longterm.offsetsMonths[i] ?? 6;
      const actualDue = addMonths(learnedAt, months);
      const due = settings.longterm.useOwnAggregation
        ? firstAggregationOnOrAfter(actualDue, aggDay, "last-day")
        : firstAggregationOnOrAfter(actualDue, aggDay, settings.monthly.shortMonthRule);
      reviews.push({
        id: uid("rev"), kind: "longterm", label: `مرور ${months} ماهه (بلندمدت)`,
        baseDate: learnedAt, dueDate: due,
        completed: false, completedAt: null, notes: "",
      });
    }
  }

  return reviews;
}
