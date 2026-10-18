import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { computeBuckets, markCompleted } from "../services/review-service";
import { AddItemModal } from "../modals/add-item-modal";
import { ChecklistModal } from "../modals/checklist-modal";
import { ItemDetailsModal } from "./item-details-modal";
import { formatWithWeekday } from "../core/persian-bridge";

export const DASHBOARD_VIEW_TYPE = "recovery-engine-dashboard";

export class DashboardView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: RecoveryEnginePlugin) {
    super(leaf);
  }

  getViewType() { return DASHBOARD_VIEW_TYPE; }
  getDisplayText() { return "Recovery Engine"; }
  getIcon() { return "calendar-check"; }

  async onOpen() { this.render(); }
  refresh() { this.render(); }

  private fmt(d: string): string {
    return formatWithWeekday(this.app, d, this.plugin.settings.dateFormat);
  }

  private async render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("recovery-engine-dashboard");
    container.setAttr("dir", "rtl");

    const header = container.createDiv({ cls: "re-header" });
    header.createEl("h2", { text: this.plugin.settings.dashboardTitle });
    const addBtn = header.createEl("button", { text: "ثبت مطلب جدید" });
    addBtn.onclick = () => new AddItemModal(this.app, this.plugin).open();

    const items = (await this.plugin.getItems()).filter((i) => !i.deleted);
    const buckets = computeBuckets(items, this.plugin.settings.upcomingWindowDays);

    if (this.plugin.settings.showStats) {
      const stats = container.createDiv({ cls: "re-stats" });
      const cells: [string, number][] = [
        ["مرورهای امروز", buckets.today.length],
        ["عقب‌افتاده", buckets.overdue.length],
        ["آیندهٔ نزدیک", buckets.upcoming.length],
        ["انجام‌شدهٔ امروز", buckets.completedToday.length],
        ["کل مطالب", items.filter((i) => !i.archived).length],
      ];
      cells.forEach(([label, n]) => {
        const c = stats.createDiv({ cls: "re-stat" });
        c.createDiv({ cls: "re-stat-num", text: String(n) });
        c.createDiv({ cls: "re-stat-label", text: label });
      });
    }

    this.renderSection(container, "مرورهای امروز", buckets.today, "today");
    this.renderSection(container, "مرورهای عقب‌افتاده", buckets.overdue, "overdue");
    this.renderSection(container, "مرورهای آینده", buckets.upcoming, "upcoming");

    if (this.plugin.settings.showCompleted && buckets.completedToday.length) {
      this.renderSection(container, "انجام‌شده‌های امروز", buckets.completedToday, "done");
    }
  }

  private renderSection(
    container: HTMLElement,
    title: string,
    rows: { item: unknown; review: unknown; daysLate?: number; daysAhead?: number }[],
    kind: string
  ) {
    const sec = container.createEl("section", { cls: "re-section" });
    sec.createEl("h3", { text: `${title} (${rows.length})` });
    if (rows.length === 0) {
      sec.createEl("p", { cls: "re-empty", text: "موردی وجود ندارد." });
      return;
    }
    const table = sec.createEl("table", { cls: "re-table" });
    const head = table.createEl("tr");
    ["درس", "مبحث", "نوع مرور", "موعد", "وضعیت", "عملیات"].forEach((h) =>
      head.createEl("th", { text: h })
    );
    const limited = rows.slice(0, this.plugin.settings.dashboardListLimit);
    for (const r of limited) {
      const subject = this.plugin.settings.subjects.find(
        (s) => s.id === r.item.subjectId
      );
      const tr = table.createEl("tr");
      tr.createEl("td", { text: subject?.name ?? "—" });
      const titleCell = tr.createEl("td", { text: r.item.title });
      titleCell.setCssStyles({ cursor: "pointer" });
      titleCell.onclick = () =>
        new ItemDetailsModal(this.app, this.plugin, r.item, () => this.refresh()).open();
      tr.createEl("td", { text: r.review.label });
      tr.createEl("td", { text: this.fmt(r.review.dueDate) });
      let statusText = "باقی‌مانده";
      if (kind === "overdue" && r.daysLate != null) statusText = `${r.daysLate} روز تأخیر`;
      if (kind === "upcoming" && r.daysAhead != null) statusText = `${r.daysAhead} روز بعد`;
      if (kind === "done") statusText = "انجام‌شده";
      tr.createEl("td", { text: statusText });
      const ops = tr.createEl("td");
      if (kind !== "done") {
        const btn = ops.createEl("button", { text: "انجام شد" });
        btn.onclick = () =>
          new ChecklistModal(this.app, this.plugin, r.item, r.review, async (cl) => {
            markCompleted(r.item, r.review.id);
            const rev = r.item.reviews.find((x: unknown) => x.id === r.review.id);
            if (rev) rev.checklistDone = cl;
            await this.plugin.saveItem(r.item);
            new Notice("مرور ثبت شد.");
            this.refresh();
          }).open();
      }
      const detailsBtn = ops.createEl("button", { text: "جزئیات" });
      detailsBtn.onclick = () =>
        new ItemDetailsModal(this.app, this.plugin, r.item, () => this.refresh()).open();
    }
  }
}
