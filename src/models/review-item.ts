export type ReviewKind = "initial" | "weekend" | "monthly" | "longterm";

export interface ReviewSession {
  id: string;
  kind: ReviewKind;
  label: string;
  baseDate: string;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  notes: string;
  checklistDone?: string[];
}

export interface HistoryEvent {
  at: string;
  type:
    | "review-completed" | "review-reopened" | "item-created" | "item-updated"
    | "item-archived" | "item-unarchived" | "item-deleted" | "item-restored"
    | "schedule-rebuilt" | "backup-restored" | "all-deleted";
  detail?: string;
}

export interface ReviewItem {
  id: string;
  subjectId: string;
  title: string;
  learnedAt: string;
  /** مسیر یا لینک فایل جزوه (ممکن است خارج از این Vault باشد) */
  source: string;
  rangeFrom: string;
  rangeTo: string;
  notes: string;
  customFields: Record<string, string>;
  reviews: ReviewSession[];
  history: HistoryEvent[];
  archived: boolean;
  deleted?: boolean;
  deletedAt?: string | null;
}

export interface Subject {
  id: string; name: string; color?: string; archived: boolean; checklist: string[];
}
export interface CycleConfig { enabled: boolean; count: number; offsets: number[]; }
export interface MonthlyConfig {
  enabled: boolean; count: number; offsetsMonths: number[];
  aggregationDay: number; shortMonthRule: "last-day" | "next-month-first";
}
export interface WeekendConfig { enabled: boolean; count: number; weekdays: number[]; }
export interface LongTermConfig {
  enabled: boolean; count: number; offsetsMonths: number[];
  useOwnAggregation: boolean; aggregationDay: number;
}
export interface ScheduleSettings {
  initial: CycleConfig; weekend: WeekendConfig; monthly: MonthlyConfig;
  longterm: LongTermConfig; countLearningDayAsFirst: boolean;
}
export interface RecoverySettings {
  displayName: string; dashboardTitle: string; schedule: ScheduleSettings;
  showStats: boolean; showCompleted: boolean; dashboardListLimit: number;
  upcomingWindowDays: number; dateFormat: "gregorian" | "jalali";
  notifyOnStartup: boolean; notifyOverdue: boolean; requireConfirmOnDelete: boolean;
  subjects: Subject[];
}
