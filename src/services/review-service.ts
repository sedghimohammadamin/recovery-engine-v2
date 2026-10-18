import { ReviewItem, ReviewSession, ReviewKind } from "../models/review-item";
import { todayISO } from "../core/date-utils";

export interface DueBuckets {
  today: { item: ReviewItem; review: ReviewSession }[];
  overdue: { item: ReviewItem; review: ReviewSession; daysLate: number }[];
  upcoming: { item: ReviewItem; review: ReviewSession; daysAhead: number }[];
  completedToday: { item: ReviewItem; review: ReviewSession }[];
}

function kindOrder(kind: ReviewKind): number {
  switch (kind) {
    case "initial": return 1;
    case "weekend": return 2;
    case "monthly": return 3;
    case "longterm": return 4;
  }
}

function compareByDueAndKind(a: unknown, b: unknown): number {
  if (a.review.dueDate !== b.review.dueDate) {
    return a.review.dueDate < b.review.dueDate ? -1 : 1;
  }
  const ka = kindOrder(a.review.kind);
  const kb = kindOrder(b.review.kind);
  if (ka !== kb) return ka - kb;
  return String(a.review.label).localeCompare(String(b.review.label));
}

export function computeBuckets(
  items: ReviewItem[],
  upcomingWindowDays: number
): DueBuckets {
  const today = todayISO();
  const result: DueBuckets = { today: [], overdue: [], upcoming: [], completedToday: [] };

  for (const item of items) {
    if (item.archived) continue;
    for (const r of item.reviews) {
      if (r.completed) {
        if (r.completedAt && r.completedAt.slice(0, 10) === today) {
          result.completedToday.push({ item, review: r });
        }
        continue;
      }
      if (r.dueDate < today) {
        const daysLate = Math.round(
          (new Date(today).getTime() - new Date(r.dueDate).getTime()) / 86400000
        );
        result.overdue.push({ item, review: r, daysLate });
      } else if (r.dueDate === today) {
        result.today.push({ item, review: r });
      } else {
        const daysAhead = Math.round(
          (new Date(r.dueDate).getTime() - new Date(today).getTime()) / 86400000
        );
        if (daysAhead <= upcomingWindowDays)
          result.upcoming.push({ item, review: r, daysAhead });
      }
    }
  }

  result.today.sort(compareByDueAndKind);
  result.overdue.sort(compareByDueAndKind);
  result.upcoming.sort(compareByDueAndKind);
  result.completedToday.sort(compareByDueAndKind);
  return result;
}

export function markCompleted(item: ReviewItem, reviewId: string): void {
  const r = item.reviews.find((x) => x.id === reviewId);
  if (!r || r.completed) return;
  r.completed = true;
  r.completedAt = new Date().toISOString();
  item.history.push({
    at: r.completedAt,
    type: "review-completed",
    detail: r.label,
  });
}

export function reopenReview(item: ReviewItem, reviewId: string): void {
  const r = item.reviews.find((x) => x.id === reviewId);
  if (!r || !r.completed) return;
  r.completed = false;
  r.completedAt = null;
  item.history.push({
    at: new Date().toISOString(),
    type: "review-reopened",
    detail: r.label,
  });
}
