import { ItemView, WorkspaceLeaf } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { ReviewItem } from "../models/review-item";
import { ItemDetailsModal } from "./item-details-modal";
import { getPersianCalendarApi } from "../core/persian-bridge";

export const CALENDAR_VIEW_TYPE = "recovery-engine-calendar";

export class CalendarView extends ItemView {
  private currentYear = 1405; // شمسی
  private currentMonth = 1; // 1 تا 12

  constructor(leaf: WorkspaceLeaf, private plugin: RecoveryEnginePlugin) {
    super(leaf);
  }

  getViewType() { return CALENDAR_VIEW_TYPE; }
  getDisplayText() { return "تقویم"; }
  getIcon() { return "calendar"; }

  async onOpen() { this.render(); }
  refresh() { this.render(); }

  private async render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("recovery-engine-dashboard");
    container.setAttr("dir", "rtl");

    // --- هدر تقویم ---
    const header = container.createEl("div", { cls: "re-cal-header" });
    header.setCssStyles({ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" });

    const prevBtn = header.createEl("button", { text: "‹" });
    prevBtn.onclick = () => {
      this.currentMonth--;
      if (this.currentMonth < 1) { this.currentMonth = 12; this.currentYear--; }
      this.render();
    };

    const title = header.createEl("h3", { text: this.getMonthName() + " " + this.currentYear });
    title.setCssStyles({ margin: "0", fontSize: "20px" });

    const nextBtn = header.createEl("button", { text: "›" });
    nextBtn.onclick = () => {
      this.currentMonth++;
      if (this.currentMonth > 12) { this.currentMonth = 1; this.currentYear++; }
      this.render();
    };

    const todayBtn = header.createEl("button", { text: "امروز" });
    todayBtn.onclick = () => {
      const api = getPersianCalendarApi(this.app);
      if (api) {
        const now = new Date();
        const j = api.gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
        this.currentYear = j.jy;
        this.currentMonth = j.jm;
      }
      this.render();
    };

    // --- دریافت همه مطالب ---
    const items = (await this.plugin.getItems()).filter(i => !i.deleted);
    
    // گروه‌بندی بر اساس تاریخ یادگیری
    const itemsByDate = new Map<string, ReviewItem[]>();
    for (const item of items) {
      if (!itemsByDate.has(item.learnedAt)) itemsByDate.set(item.learnedAt, []);
      itemsByDate.get(item.learnedAt)!.push(item);
    }

    // --- ساخت شبکه تقویم ---
    const api = getPersianCalendarApi(this.app);
    const grid = container.createEl("div", { cls: "re-cal-grid" });
    grid.setCssStyles({ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" });

    // نام روزهای هفته (شنبه تا جمعه)
    const weekDays = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
    weekDays.forEach(day => {
      const cell = grid.createEl("div", { text: day });
      cell.setCssStyles({ textAlign: "center", fontWeight: "bold", padding: "8px", background: "var(--background-secondary)", borderRadius: "6px" });
    });

    // محاسبه روزهای ماه
    const daysInMonth = this.getDaysInMonth(this.currentYear, this.currentMonth);
    // روز اول ماه چه روزی از هفته است؟ (0=شنبه، 6=جمعه)
    const firstDayOfWeek = this.getFirstDayOfWeek(this.currentYear, this.currentMonth);

    // سلول‌های خالی قبل از روز اول
    for (let i = 0; i < firstDayOfWeek; i++) {
      grid.createEl("div", { cls: "re-cal-cell empty" });
    }

    // روزهای ماه
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = grid.createEl("div", { cls: "re-cal-cell" });
      cell.setCssStyles({
        minHeight: "80px",
        padding: "6px",
        background: "var(--background-primary)",
        border: "1px solid var(--background-modifier-border)",
        borderRadius: "8px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "4px"
      });

      // شماره روز
      const dayNum = cell.createEl("div", { text: String(day) });
      dayNum.setCssStyles({ fontWeight: "bold", marginBottom: "4px" });

      // تبدیل تاریخ شمسی این روز به میلادی
      let isoDate: string | null = null;
      if (api) {
        try {
          const g = api.jalaliToGregorian(this.currentYear, this.currentMonth, day);
          isoDate = `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
        } catch (e) { /* ignore */ }
      }

      if (isoDate) {
        const dayItems = itemsByDate.get(isoDate) || [];
        if (dayItems.length > 0) {
          const badge = cell.createEl("div", { text: `${dayItems.length} مبحث` });
          badge.setCssStyles({ fontSize: "11px", background: "var(--interactive-accent)", color: "white", padding: "2px 6px", borderRadius: "10px", alignSelf: "flex-start" });
          
          cell.onclick = () => {
            this.showDayDetails(dayItems, isoDate!);
          };
        } else {
          cell.onclick = () => { /* no-op */ };
        }
      }

      grid.appendChild(cell);
    }

    // --- بخش نمایش جزئیات ---
    const detailContainer = container.createEl("div", { cls: "re-cal-details" });
    detailContainer.setCssStyles({ marginTop: "20px" });
  }

  private showDayDetails(items: ReviewItem[], isoDate: string) {
    const container = this.containerEl.children[1] as HTMLElement;
    const existing = container.querySelector(".re-cal-details");
    if (existing) existing.empty();

    const box = (existing as HTMLElement) || container.createEl("div", { cls: "re-cal-details" });
    box.setCssStyles({ marginTop: "20px", padding: "16px", background: "var(--background-secondary)", borderRadius: "12px" });

    box.createEl("h4", { text: `مباحث ثبت‌شده در این روز (${items.length})` });
    
    const table = box.createEl("table", { cls: "re-table" });
    const head = table.createEl("tr");
    ["عنوان مبحث", "درس", "عملیات"].forEach(h => head.createEl("th", { text: h }));

    for (const item of items) {
      const subject = this.plugin.settings.subjects.find(s => s.id === item.subjectId);
      const row = table.createEl("tr");
      row.createEl("td", { text: item.title });
      row.createEl("td", { text: subject?.name ?? "—" });
      const ops = row.createEl("td");
      const btn = ops.createEl("button", { text: "جزئیات" });
      btn.onclick = () => new ItemDetailsModal(this.app, this.plugin, item, () => this.render()).open();
    }
  }

  private getMonthName(): string {
    const names = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    return names[this.currentMonth - 1];
  }

  private getDaysInMonth(year: number, month: number): number {
    if (month <= 6) return 31;
    if (month <= 11) return 30;
    // اسفند (ماه 12)
    return 29; // برای سادگی
  }

  private getFirstDayOfWeek(year: number, month: number): number {
    const api = getPersianCalendarApi(this.app);
    if (!api) return 0;
    try {
      const g = api.jalaliToGregorian(year, month, 1);
      const date = new Date(g.gy, g.gm - 1, g.gd);
      const jsDay = date.getDay(); // 0=یکشنبه, 6=شنبه
      // تبدیل به شمسی: شنبه=0, یکشنبه=1, ... جمعه=6
      return (jsDay + 1) % 7;
    } catch (e) {
      return 0;
    }
  }
}
