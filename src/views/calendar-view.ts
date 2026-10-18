import { ItemView, WorkspaceLeaf } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { ReviewItem, ReviewSession } from "../models/review-item";
import { ItemDetailsModal } from "./item-details-modal";
import { getPersianCalendarApi } from "../core/persian-bridge";

export const CALENDAR_VIEW_TYPE = "recovery-engine-calendar";

export class CalendarView extends ItemView {
  private gYear = new Date().getFullYear();
  private gMonth = new Date().getMonth();
  private selectedIso: string | null = null;

  constructor(leaf: WorkspaceLeaf, private plugin: RecoveryEnginePlugin) { super(leaf); }
  getViewType() { return CALENDAR_VIEW_TYPE; }
  getDisplayText() { return "تقویم مرور"; }
  getIcon() { return "calendar"; }

  async onOpen() { this.render(); }
  refresh() { this.render(); }

  private async render() {
    const c = this.containerEl.children[1] as HTMLElement;
    c.empty();
    c.addClass("recovery-engine-dashboard");
    c.setAttr("dir", "rtl");

    const header = c.createDiv({ cls: "re-cal-header" });
    const prev = header.createEl("button", { text: "‹" });
    prev.onclick = () => { this.gMonth--; if (this.gMonth < 0) { this.gMonth = 11; this.gYear--; } this.render(); };
    const api = getPersianCalendarApi(this.app);
    let title = `${this.gMonthName(this.gMonth)} ${this.gYear}`;
    if (api) {
      const j = api.gregorianToJalali(this.gYear, this.gMonth + 1, 1);
      title = `${api.jalaliMonthName(j.jm)} ${j.jy}`;
    }
    header.createEl("h3", { text: title });
    const next = header.createEl("button", { text: "›" });
    next.onclick = () => { this.gMonth++; if (this.gMonth > 11) { this.gMonth = 0; this.gYear++; } this.render(); };
    const today = header.createEl("button", { text: "امروز" });
    today.onclick = () => { const d = new Date(); this.gYear = d.getFullYear(); this.gMonth = d.getMonth(); this.render(); };

    const items = (await this.plugin.getItems()).filter((i) => !i.deleted && !i.archived);
    const map = new Map<string, { item: ReviewItem; review: ReviewSession }[]>();
    for (const item of items) {
      for (const r of item.reviews) {
        const arr = map.get(r.dueDate) ?? [];
        arr.push({ item, review: r });
        map.set(r.dueDate, arr);
      }
    }

    const grid = c.createDiv({ cls: "re-cal-grid" });
    ["ی", "د", "س", "چ", "پ", "ج", "ش"].forEach((d) =>
      grid.createDiv({ cls: "re-cal-dow", text: d })
    );

    const firstDay = new Date(this.gYear, this.gMonth, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(this.gYear, this.gMonth + 1, 0).getDate();

    for (let i = 0; i < startOffset; i++) grid.createDiv({ cls: "re-cal-cell empty" });

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${this.gYear}-${String(this.gMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const entries = map.get(iso) ?? [];
      const cell = grid.createDiv({ cls: "re-cal-cell" });
      cell.createDiv({ cls: "re-cal-day", text: String(d) });
      if (entries.length) {
        cell.createDiv({ cls: "re-cal-count", text: `${entries.length}` });
        cell.addClass("has-reviews");
        if (entries.some((e) => !e.review.completed)) cell.addClass("has-pending");
      }
      cell.onclick = () => { this.selectedIso = iso; this.renderDetails(c, map); };
    }

    this.renderDetails(c, map);
  }

  private renderDetails(c: HTMLElement, map: Map<string, { item: ReviewItem; review: ReviewSession }[]>) {
    const existing = c.querySelector(".re-cal-details");
    existing?.remove();
    if (!this.selectedIso) return;
    const entries = map.get(this.selectedIso) ?? [];
    const box = c.createDiv({ cls: "re-cal-details" });
    box.createEl("h3", { text: `مرورهای ${this.selectedIso} (${entries.length})` });
    if (!entries.length) { box.createEl("p", { cls: "re-empty", text: "موردی نیست." }); return; }
    const table = box.createEl("table", { cls: "re-table" });
    const head = table.createEl("tr");
    ["درس", "مبحث", "نوع", "وضعیت"].forEach((h) => head.createEl("th", { text: h }));
    for (const e of entries) {
      const subject = this.plugin.settings.subjects.find((s) => s.id === e.item.subjectId);
      const tr = table.createEl("tr");
      tr.createEl("td", { text: subject?.name ?? "—" });
      const t = tr.createEl("td", { text: e.item.title });
      t.setCssStyles({ cursor: "pointer" });
      t.onclick = () => new ItemDetailsModal(this.app, this.plugin, e.item, () => this.render()).open();
      tr.createEl("td", { text: e.review.label });
      tr.createEl("td", { text: e.review.completed ? "انجام‌شده" : "باقی‌مانده" });
    }
  }

  private gMonthName(m: number): string {
    return ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"][m];
  }
}
