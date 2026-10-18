import { ItemView, WorkspaceLeaf } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { todayISO, addDays } from "../core/date-utils";

export const REPORTS_VIEW_TYPE = "recovery-engine-reports";

export class ReportsView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: RecoveryEnginePlugin) {
    super(leaf);
  }
  getViewType() { return REPORTS_VIEW_TYPE; }
  getDisplayText() { return "گزارش‌ها"; }
  getIcon() { return "bar-chart"; }

  async onOpen() { this.render(); }
  refresh() { this.render(); }

  private async render() {
    const c = this.containerEl.children[1];
    c.empty();
    c.addClass("recovery-engine-dashboard");
    c.setAttr("dir", "rtl");
    c.createEl("h2", { text: "گزارش عملکرد" });

    const items = (await this.plugin.getItems()).filter((i) => !i.deleted);
    const today = todayISO();
    const last7 = addDays(today, -7);
    const last30 = addDays(today, -30);

    const allReviews = items.flatMap((i) =>
      i.reviews.map((r) => ({ item: i, r }))
    );

    const done7 = allReviews.filter((x) => x.r.completed && x.r.completedAt && x.r.completedAt.slice(0, 10) >= last7).length;
    const done30 = allReviews.filter((x) => x.r.completed && x.r.completedAt && x.r.completedAt.slice(0, 10) >= last30).length;
    const pending = allReviews.filter((x) => !x.r.completed).length;
    const overdue = allReviews.filter((x) => !x.r.completed && x.r.dueDate < today).length;

    const stats = c.createDiv({ cls: "re-stats" });
    const cells: [string, number][] = [
      ["انجام‌شده ۷ روز اخیر", done7],
      ["انجام‌شده ۳۰ روز اخیر", done30],
      ["باقی‌مانده", pending],
      ["عقب‌افتاده", overdue],
    ];
    cells.forEach(([l, n]) => {
      const cell = stats.createDiv({ cls: "re-stat" });
      cell.createDiv({ cls: "re-stat-num", text: String(n) });
      cell.createDiv({ cls: "re-stat-label", text: l });
    });

    c.createEl("h3", { text: "به تفکیک درس" });
    const table = c.createEl("table", { cls: "re-table" });
    const head = table.createEl("tr");
    ["درس", "مطالب", "مرور کل", "انجام‌شده", "باقی‌مانده", "عقب‌افتاده"].forEach((h) =>
      head.createEl("th", { text: h })
    );

    for (const subject of this.plugin.settings.subjects) {
      const sis = items.filter((i) => i.subjectId === subject.id);
      const sreviews = sis.flatMap((i) => i.reviews);
      const done = sreviews.filter((r) => r.completed).length;
      const remain = sreviews.length - done;
      const ov = sreviews.filter((r) => !r.completed && r.dueDate < today).length;
      const tr = table.createEl("tr");
      tr.createEl("td", { text: subject.name });
      tr.createEl("td", { text: String(sis.length) });
      tr.createEl("td", { text: String(sreviews.length) });
      tr.createEl("td", { text: String(done) });
      tr.createEl("td", { text: String(remain) });
      tr.createEl("td", { text: String(ov) });
    }
  }
}
