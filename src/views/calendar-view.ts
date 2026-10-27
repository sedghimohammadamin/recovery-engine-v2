import { ItemView, WorkspaceLeaf } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { ReviewItem } from "../models/review-item";
import { ItemDetailsModal } from "./item-details-modal";

export const CALENDAR_VIEW_TYPE = "recovery-engine-calendar";

export class CalendarView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: RecoveryEnginePlugin) {
    super(leaf);
  }

  getViewType() { return CALENDAR_VIEW_TYPE; }
  getDisplayText() { return "تقویم"; }
  getIcon() { return "calendar"; }

  async onOpen() { this.render(); }
  refresh() { this.render(); }

  async render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("recovery-engine-dashboard");
    container.setAttr("dir", "rtl");

    // --- بخش تقویم داخل داشبورد ---
    const calSection = container.createEl("section", { cls: "re-cal-section" });
    calSection.setCssStyles({ marginTop: "24px", borderTop: "1px solid var(--background-modifier-border)", paddingTop: "16px" });

    calSection.createEl("h3", { text: "📅 تقویم مباحث" });
    calSection.setCssStyles({ marginBottom: "16px" });

    const items = (await this.plugin.getItems()).filter(i => !i.deleted);
    
    // گروه‌بندی بر اساس تاریخ یادگیری (ISO: YYYY-MM-DD)
    const itemsByDate = new Map<string, ReviewItem[]>();
    for (const item of items) {
      if (!itemsByDate.has(item.learnedAt)) itemsByDate.set(item.learnedAt, []);
      itemsByDate.get(item.learnedAt)!.push(item);
    }

    // --- شبکه تقویم (میلادی ساده) ---
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-11

    const monthNames = ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"];
    const header = calSection.createEl("div", { cls: "re-cal-header" });
    header.createEl("h4", { text: `${monthNames[currentMonth]} ${currentYear}` });

    const grid = calSection.createEl("div", { cls: "re-cal-grid" });

    // نام روزهای هفته (شنبه تا جمعه، RTL)
    const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
    weekDays.forEach(d => {
      const cell = grid.createEl("div", { text: d, cls: "re-cal-dow" });
      cell.setCssStyles({ textAlign: "center", fontWeight: "bold", padding: "8px", color: "var(--text-muted)" });
    });

    // روز اول ماه چه روزی از هفته است؟
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startOffset = (firstDay.getDay() + 1) % 7; // شنبه=0
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // سلول‌های خالی
    for (let i = 0; i < startOffset; i++) {
      const empty = grid.createEl("div", { cls: "re-cal-cell empty" });
      empty.setCssStyles({ minHeight: "70px", background: "transparent", border: "none" });
    }

    // روزها
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayItems = itemsByDate.get(iso) || [];
      
      const cell = grid.createEl("div", { cls: "re-cal-cell" });
      cell.setCssStyles({
        minHeight: "70px",
        padding: "6px",
        background: dayItems.length > 0 ? "var(--background-modifier-hover)" : "var(--background-secondary)",
        border: "1px solid var(--background-modifier-border)",
        borderRadius: "8px",
        cursor: dayItems.length > 0 ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        position: "relative"
      });

      const dayNum = cell.createEl("div", { text: String(day) });
      dayNum.setCssStyles({ fontWeight: "bold", fontSize: "13px" });

      if (dayItems.length > 0) {
        const badge = cell.createEl("div", { text: `${dayItems.length}`, cls: "re-cal-badge" });
        badge.setCssStyles({
          fontSize: "10px",
          background: "var(--interactive-accent)",
          color: "white",
          padding: "1px 6px",
          borderRadius: "10px",
          alignSelf: "flex-start"
        });

        cell.onclick = () => {
          this.showDayDetails(calSection, dayItems, iso);
        };
      }
    }
  }

  private showDayDetails(container: HTMLElement, items: ReviewItem[], isoDate: string) {
    const existing = container.querySelector(".re-cal-details");
    if (existing) existing.remove();

    const box = container.createEl("div", { cls: "re-cal-details" });
    box.setCssStyles({ marginTop: "16px", padding: "16px", background: "var(--background-secondary)", borderRadius: "12px", border: "1px solid var(--background-modifier-border)" });

    box.createEl("h4", { text: `مباحث روز ${isoDate} (${items.length})` });

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
}
