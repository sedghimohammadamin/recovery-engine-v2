import { Notice, Plugin, WorkspaceLeaf, Platform } from "obsidian";
import { StorageService, DEFAULT_SETTINGS } from "./services/storage-service";
import { RecoverySettings, ReviewItem } from "./models/review-item";
import { DashboardView, DASHBOARD_VIEW_TYPE } from "./views/dashboard-view";
import { ItemsView, ITEMS_VIEW_TYPE } from "./views/items-view";
import { CalendarView, CALENDAR_VIEW_TYPE } from "./views/calendar-view";
import { ReportsView, REPORTS_VIEW_TYPE } from "./views/reports-view";
import { AddItemModal } from "./modals/add-item-modal";
import { RecoverySettingsTab } from "./settings/settings-tab";
import { buildSchedule } from "./core/scheduler";
import { todayISO } from "./core/date-utils";
import { notify } from "./services/notify-service";
import { sendMacNotificationWithActions } from "./services/notify-mac";
import { openVaultUri } from "./services/open-vault";

export default class RecoveryEnginePlugin extends Plugin {
  settings: RecoverySettings = structuredClone(DEFAULT_SETTINGS);
  storage!: StorageService;
  private itemsCache: ReviewItem[] | null = null;

  async onload() {
    this.storage = new StorageService(this);
    this.settings = await this.storage.loadSettings();

    this.registerView(DASHBOARD_VIEW_TYPE, (l) => new DashboardView(l, this));
    this.registerView(ITEMS_VIEW_TYPE, (l) => new ItemsView(l, this));
    this.registerView(CALENDAR_VIEW_TYPE, (l) => new CalendarView(l, this));
    this.registerView(REPORTS_VIEW_TYPE, (l) => new ReportsView(l, this));

    this.addRibbonIcon("calendar-check", "Recovery Engine", () => this.openView(DASHBOARD_VIEW_TYPE));

    this.addCommand({ id: "open-dashboard", name: "بازکردن داشبورد مرور", callback: () => this.openView(DASHBOARD_VIEW_TYPE) });
    this.addCommand({ id: "open-items", name: "همهٔ مطالب", callback: () => this.openView(ITEMS_VIEW_TYPE) });
    this.addCommand({ id: "open-calendar", name: "تقویم مرور", callback: () => this.openView(CALENDAR_VIEW_TYPE) });
    this.addCommand({ id: "open-reports", name: "گزارش‌ها", callback: () => this.openView(REPORTS_VIEW_TYPE) });
    this.addCommand({ id: "add-item", name: "ثبت مطلب جدید", callback: () => new AddItemModal(this.app, this).open() });

    this.addCommand({
      id: "rebuild-schedules",
      name: "بازسازی برنامهٔ مرور همهٔ مطالب (با تأیید)",
      callback: async () => {
        const items = (await this.getItems()).filter((i) => !i.deleted);
        if (!items.length) { new Notice("مطلبی ثبت نشده."); return; }
        if (!confirm(`برنامهٔ ${items.length} مطلب بازسازی شود؟ مرورهای انجام‌شده حفظ می‌شوند.`)) return;
        for (const item of items) {
          const fresh = buildSchedule(item.learnedAt, this.settings.schedule);
          const completedByLabel = new Map(item.reviews.filter((r) => r.completed).map((r) => [r.label, r] as const));
          item.reviews = fresh.map((r) => {
            const prev = completedByLabel.get(r.label);
            return prev && prev.completed ? { ...r, completed: true, completedAt: prev.completedAt } : r;
          });
          item.history.push({ at: new Date().toISOString(), type: "schedule-rebuilt" });
        }
        await this.storage.saveItems(items);
        this.itemsCache = items;
        this.refreshDashboards();
        new Notice("برنامه‌ها بازسازی شدند.");
      },
    });

    this.addSettingTab(new RecoverySettingsTab(this.app, this));

    // اعلان هنگام باز شدن
    this.app.workspace.onLayoutReady(async () => {
      if (!this.settings.notifyOnStartup) return;
      const items = (await this.getItems()).filter((i) => !i.deleted && !i.archived);
      const today = todayISO();
      const due = items.flatMap((i) => i.reviews.filter((r) => !r.completed && r.dueDate === today).map((r) => ({ i, r })));
      const overdue = items.flatMap((i) => i.reviews.filter((r) => !r.completed && r.dueDate < today).map((r) => ({ i, r })));
      const mode = (this.settings as unknown).notifyMode ?? "both";

      if (this.settings.notifyOverdue && overdue.length > 0) {
        if (Platform.isMacOS) {
          sendMacNotificationWithActions(
            "Recovery Engine",
            `${overdue.length} مرور عقب‌افتاده داری`,
            [
              { id: "open", label: "باز کردن والت" },
              { id: "snooze", label: "تعویق" },
            ],
            (choice) => {
              if (choice === "open") this.openVault();
              else if (choice === "snooze") new Notice("تعویق شد (شبیه‌سازی).");
            }
          );
        } else {
          notify(
            this.app,
            "Recovery Engine",
            `⚠️ ${overdue.length} مرور عقب‌افتاده داری.`,
            mode,
            [
              { label: "باز کردن والت", onClick: () => this.openVault() },
              { label: "تعویق", onClick: () => new Notice("تعویق شد (شبیه‌سازی).") },
            ]
          );
        }
      }

      if (due.length > 0) {
        notify(this.app, "Recovery Engine", `📅 ${due.length} مرور برای امروز داری.`, mode);
      }
    });
  }

  onunload() {}

  /**
   * باز کردن والت فعلی.
   * اولویت اول: path (مقاوم‌تر در برابر باگ فعلی Obsidian)
   * اولویت دوم: vault با appId
   */
  private openVault() {
    const id = this.settings.vaultId?.trim() || "2684169028beb4f9";
    const uri = `obsidian://open?vault=${encodeURIComponent(id)}`;
    console.log("[RecoveryEngine] openVault called with uri:", uri);

    try {
      const req = (window as unknown).require;
      if (typeof req !== "function") {
        console.error("[RecoveryEngine] window.require در دسترس نیست");
        window.open(uri, "_blank");
        return;
      }
      const { exec } = req("child_process");
      const cmd = `open "${uri}"`;
      console.log("[RecoveryEngine] exec:", cmd);
      exec(cmd, (err: unknown, stdout: string, stderr: string) => {
        console.log("[RecoveryEngine] open stdout:", stdout, "stderr:", stderr, "err:", err);
        if (err) {
          console.error("[RecoveryEngine] open error:", err);
          new Notice("خطا در باز کردن والت. کنسول را ببین.");
        }
      });
    } catch (e) {
      console.error("[RecoveryEngine] catch در openVault:", e);
      window.open(uri, "_blank");
    }
  }

  async openView(type: string) {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(type)[0] ?? null;
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  refreshDashboards() {
    [DASHBOARD_VIEW_TYPE, ITEMS_VIEW_TYPE, CALENDAR_VIEW_TYPE, REPORTS_VIEW_TYPE].forEach((t) => {
      this.app.workspace.getLeavesOfType(t).forEach((l) => {
        const v: unknown = l.view;
        if (typeof v.refresh === "function") v.refresh();
      });
    });
  }

  async getItems(): Promise<ReviewItem[]> {
    if (!this.itemsCache) this.itemsCache = await this.storage.loadItems();
    return this.itemsCache;
  }

  async addItem(item: ReviewItem): Promise<void> {
    const items = await this.getItems();
    items.push(item);
    this.itemsCache = items;
    await this.storage.saveItems(items);
    this.refreshDashboards();
  }

  async saveItem(item: ReviewItem): Promise<void> {
    const items = await this.getItems();
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) items[idx] = item; else items.push(item);
    await this.storage.saveItems(items);
    this.refreshDashboards();
  }

  async removeItemPermanently(id: string): Promise<void> {
    const items = (await this.getItems()).filter((i) => i.id !== id);
    this.itemsCache = items;
    await this.storage.saveItems(items);
    this.refreshDashboards();
  }

  async deleteAllItems(): Promise<void> {
    this.itemsCache = [];
    await this.storage.saveItems([]);
    this.refreshDashboards();
  }

  async saveSettings(): Promise<void> {
    await this.storage.saveSettings(this.settings);
  }

  async resetAll(): Promise<void> {
    this.itemsCache = [];
    await this.storage.saveItems([]);
    this.settings = structuredClone(DEFAULT_SETTINGS);
    await this.storage.saveSettings(this.settings);
    this.refreshDashboards();
  }

  async exportData(): Promise<unknown> {
    const items = await this.getItems();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: this.settings,
      items,
    };
  }

  async replaceAllData(data: { settings: unknown; items: ReviewItem[] }): Promise<void> {
    if (data.settings) {
      this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
      await this.storage.saveSettings(this.settings);
    }
    this.itemsCache = data.items;
    await this.storage.saveItems(data.items);
    this.refreshDashboards();
  }
}
