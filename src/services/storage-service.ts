import { Plugin } from "obsidian";
import { RecoverySettings, ReviewItem } from "../models/review-item";

export interface VaultData { version: 1; items: ReviewItem[]; }

export const DEFAULT_SETTINGS: RecoverySettings = {
  displayName: "Recovery Engine",
  dashboardTitle: "داشبورد مرور",
  showStats: true,
  showCompleted: false,
  dashboardListLimit: 50,
  upcomingWindowDays: 7,
  dateFormat: "gregorian",
  notifyOnStartup: true,
  notifyOverdue: true,
  requireConfirmOnDelete: true,
  subjects: [],
  schedule: {
    countLearningDayAsFirst: true,
    initial: { enabled: true, count: 3, offsets: [0, 1, 2] },
    weekend: { enabled: true, count: 2, weekdays: [4, 5] },
    monthly: { enabled: true, count: 3, offsetsMonths: [1, 2, 3], aggregationDay: 25, shortMonthRule: "last-day" },
    longterm: { enabled: true, count: 1, offsetsMonths: [6], useOwnAggregation: false, aggregationDay: 25 },
  },
};

export class StorageService {
  constructor(private plugin: Plugin) {}

  async loadSettings(): Promise<RecoverySettings> {
    const data = await this.plugin.loadData();
    return mergeSettings(DEFAULT_SETTINGS, data?.settings);
  }

  async saveSettings(s: RecoverySettings): Promise<void> {
    const data = (await this.plugin.loadData()) ?? {};
    data.settings = s;
    await this.plugin.saveData(data);
  }

  async loadItems(): Promise<ReviewItem[]> {
    const data = (await this.plugin.loadData()) ?? {};
    const v = data.vault as VaultData | undefined;
    return v?.items ?? [];
  }

  async saveItems(items: ReviewItem[]): Promise<void> {
    const data = (await this.plugin.loadData()) ?? {};
    const vault: VaultData = { version: 1, items };
    data.vault = vault;
    await this.plugin.saveData(data);
  }
}

function mergeSettings(base: RecoverySettings, saved?: Partial<RecoverySettings>): RecoverySettings {
  if (!saved) return structuredClone(base);
  return {
    ...base,
    ...saved,
    schedule: {
      ...base.schedule,
      ...(saved.schedule ?? {}),
      initial: { ...base.schedule.initial, ...(saved.schedule?.initial ?? {}) },
      weekend: { ...base.schedule.weekend, ...(saved.schedule?.weekend ?? {}) },
      monthly: { ...base.schedule.monthly, ...(saved.schedule?.monthly ?? {}) },
      longterm: { ...base.schedule.longterm, ...(saved.schedule?.longterm ?? {}) },
    },
    subjects: saved.subjects?.length ? saved.subjects : base.subjects,
  };
}
