import { ItemView, WorkspaceLeaf, Notice, TFile, setIcon } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { computeBuckets, markCompleted, snoozeReview } from "../services/review-service";
import { AddItemModal } from "../modals/add-item-modal";
import { ChecklistModal } from "../modals/checklist-modal";
import { ItemDetailsModal } from "./item-details-modal";
import { formatDateForDisplay } from "../core/persian-bridge";

export const DASHBOARD_VIEW_TYPE = "recovery-engine-dashboard";

export class DashboardView extends ItemView {
  private sortTime: "asc" | "desc" | "none" = "none";
  private sortName: "asc" | "desc" | "none" = "none";

  constructor(leaf: WorkspaceLeaf, private plugin: RecoveryEnginePlugin) {
    super(leaf);
  }

  getViewType() { return DASHBOARD_VIEW_TYPE; }
  getDisplayText() { return "Recovery Engine"; }
  getIcon() { return "calendar-check"; }

  async onOpen() { this.render(); }
  refresh() { this.render(); }

  private fmt(d: string): string {
    return formatDateForDisplay(this.app, d, this.plugin.settings.dateFormat);
  }

  private async render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("recovery-engine-dashboard");
    container.setAttr("dir", "rtl");

    // --- هدر ---
    const header = container.createEl("div", { cls: "re-header" });
    const titleWrap = header.createEl("div");
    titleWrap.setCssStyles({ display: "flex", alignItems: "center", gap: "10px" });
    const iconEl = titleWrap.createEl("div");
    setIcon(iconEl, "calendar-check");
    iconEl.setCssStyles({ color: "var(--interactive-accent)", width: "24px", height: "24px" });
    titleWrap.createEl("h2", { text: this.plugin.settings.dashboardTitle });

    const addBtn = header.createEl("button", { text: "＋ ثبت مطلب جدید" });
    addBtn.addClass("mod-cta");
    addBtn.onclick = () => new AddItemModal(this.app, this.plugin).open();

    const items = (await this.plugin.getItems()).filter((i) => !i.deleted);
    const buckets = computeBuckets(items, this.plugin.settings.upcomingWindowDays);

    // --- آمار ---
    if (this.plugin.settings.showStats) {
      const stats = container.createEl("div", { cls: "re-stats" });
      const cells: { label: string; n: number; icon: string; color: string }[] = [
        { label: "امروز", n: buckets.today.length, icon: "sun", color: "var(--text-accent)" },
        { label: "عقب‌افتاده", n: buckets.overdue.length, icon: "alert-circle", color: "var(--text-error)" },
        { label: "آینده", n: buckets.upcoming.length, icon: "calendar", color: "var(--text-muted)" },
        { label: "انجام‌شده", n: buckets.completedToday.length, icon: "check-circle", color: "var(--color-green)" },
        { label: "کل مطالب", n: items.filter((i) => !i.archived).length, icon: "book-open", color: "var(--text-normal)" },
      ];
      cells.forEach(({ label, n, icon, color }) => {
        const c = stats.createEl("div", { cls: "re-stat" });
        const ic = c.createEl("div");
        setIcon(ic, icon);
        ic.setCssStyles({ width: "28px", height: "28px", margin: "0 auto 8px", color });
        c.createEl("div", { cls: "re-stat-num", text: String(n) });
        c.createEl("div", { cls: "re-stat-label", text: label });
      });
    }

    // --- فیلترها ---
    const filterBar = container.createEl("div", { cls: "re-filter-bar" });
    filterBar.setCssStyles({ marginBottom: "16px", padding: "12px", background: "var(--background-secondary)", borderRadius: "12px", display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" });

    const timeLabel = filterBar.createEl("span", { text: "زمان یادگیری:" });
    timeLabel.setCssStyles({ fontSize: "12px", color: "var(--text-muted)" });
    const timeSelect = filterBar.createEl("select");
    timeSelect.setCssStyles({ padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--background-modifier-border)", background: "var(--background-primary)", color: "var(--text-normal)", fontSize: "13px" });
    [
      { value: "none", label: "بدون ترتیب" },
      { value: "asc", label: "قدیمی به جدید" },
      { value: "desc", label: "جدید به قدیمی" },
    ].forEach(opt => timeSelect.createEl("option", { text: opt.label, value: opt.value }));
    timeSelect.value = this.sortTime;
    timeSelect.onchange = () => { this.sortTime = timeSelect.value as any; this.refresh(); };

    const nameLabel = filterBar.createEl("span", { text: "نام مبحث:" });
    nameLabel.setCssStyles({ fontSize: "12px", color: "var(--text-muted)" });
    const nameSelect = filterBar.createEl("select");
    nameSelect.setCssStyles({ padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--background-modifier-border)", background: "var(--background-primary)", color: "var(--text-normal)", fontSize: "13px" });
    [
      { value: "none", label: "بدون ترتیب" },
      { value: "asc", label: "الفبا (أ-ی)" },
      { value: "desc", label: "برعکس (ی-أ)" },
    ].forEach(opt => nameSelect.createEl("option", { text: opt.label, value: opt.value }));
    nameSelect.value = this.sortName;
    nameSelect.onchange = () => { this.sortName = nameSelect.value as any; this.refresh(); };

    // --- مرتب‌سازی ---
    buckets.today.sort((a, b) => {
      if (this.sortTime !== "none") {
        const res = a.item.learnedAt.localeCompare(b.item.learnedAt);
        if (res !== 0) return this.sortTime === "asc" ? res : -res;
      }
      if (this.sortName !== "none") {
        const res = a.item.title.localeCompare(b.item.title, "fa");
        if (res !== 0) return this.sortName === "asc" ? res : -res;
      }
      return 0;
    });

    // --- نمایش بخش‌ها ---
    this.renderSection(container, "مرورهای امروز", buckets.today, "today");
    this.renderSection(container, "مرورهای عقب‌افتاده", buckets.overdue, "overdue");
    this.renderSection(container, "مرورهای آینده", buckets.upcoming, "upcoming");

    if (this.plugin.settings.showCompleted && buckets.completedToday.length) {
      this.renderSection(container, "انجام‌شده‌های امروز", buckets.completedToday, "done");
    }

    if (buckets.snoozed.length > 0) {
      const sec = container.createEl("section", { cls: "re-section" });
      sec.createEl("h3", { text: `تعویق‌شده‌ها (${buckets.snoozed.length})` });
      const t = sec.createEl("table", { cls: "re-table" });
      const h = t.createEl("tr");
      ["درس", "مبحث", "نوع مرور", "تا تاریخ"].forEach((x) => h.createEl("th", { text: x }));
      for (const r of buckets.snoozed) {
        const subj = this.plugin.settings.subjects.find((s) => s.id === r.item.subjectId);
        const row = t.createEl("tr");
        row.createEl("td", { text: subj?.name ?? "—" });
        row.createEl("td", { text: r.item.title });
        row.createEl("td", { text: r.review.label });
        row.createEl("td", { text: this.fmt(r.untilDate) });
      }
    }
  }

  private async openSourceInCurrentPane(src: string) {
    const clean = src.trim();
    if (!clean) return;
    const file = this.app.vault.getAbstractFileByPath(clean);
    if (file instanceof TFile) {
      // باز کردن در همان پنل
      await this.app.workspace.getLeaf(false).openFile(file);
      return;
    }
    // سعی در پیدا کردن لینک داخلی
    const wiki = clean.match(/^\[\[(.*?)\]\]$/);
    if (wiki) {
      const target = this.app.metadataCache.getFirstLinkpathDest(wiki[1], "");
      if (target) {
        await this.app.workspace.getLeaf(false).openFile(target);
        return;
      }
    }
    // اگر URL بود، باز کن
    if (/^https?:\/\//i.test(clean) || clean.startsWith("obsidian://")) {
      window.open(clean, "_blank");
      return;
    }
    new Notice("فایل منبع پیدا نشد.");
  }

  private renderSection(container: HTMLElement, title: string, rows: any[], kind: string) {
    const sec = container.createEl("section", { cls: "re-section" });
    sec.createEl("h3", { text: `${title} (${rows.length})` });
    
    if (rows.length === 0) {
      sec.createEl("p", { cls: "re-empty", text: "موردی وجود ندارد." });
      return;
    }

    const grouped: Record<string, any[]> = {};
    for (const r of rows.slice(0, this.plugin.settings.dashboardListLimit)) {
      const subjId = r.item.subjectId;
      if (!grouped[subjId]) grouped[subjId] = [];
      grouped[subjId].push(r);
    }

    for (const [subjId, subjRows] of Object.entries(grouped)) {
      const subject = this.plugin.settings.subjects.find((s) => s.id === subjId);
      const subjectName = subject?.name ?? "بدون درس";

      const subSec = sec.createEl("div", { cls: "re-subject-group" });
      subSec.setCssStyles({ marginTop: "16px", border: "1px solid var(--background-modifier-border)", borderRadius: "12px", overflow: "hidden" });

      const subHeader = subSec.createEl("div", { cls: "re-subject-header" });
      subHeader.setCssStyles({ padding: "10px 16px", background: "var(--background-secondary)", borderBottom: "1px solid var(--background-modifier-border)", fontWeight: "700", color: "var(--text-accent)", fontSize: "14px" });
      subHeader.textContent = `${subjectName} (${subjRows.length} مرور)`;

      const table = subSec.createEl("table", { cls: "re-table" });
      table.setCssStyles({ margin: "0" });
      
      const head = table.createEl("tr");
      ["مبحث", "نوع مرور", "موعد", "وضعیت", "منبع", "عملیات"].forEach((h) => head.createEl("th", { text: h }));

      for (const r of subjRows) {
        const tr = table.createEl("tr");
        
        const titleCell = tr.createEl("td", { text: r.item.title });
        titleCell.style.cursor = "pointer";
        titleCell.onclick = () => new ItemDetailsModal(this.app, this.plugin, r.item, () => this.refresh()).open();
          
        tr.createEl("td", { text: r.review.label });
        tr.createEl("td", { text: this.fmt(r.review.dueDate) });
        
        let statusText = "باقی‌مانده";
        if (kind === "overdue" && r.daysLate != null) statusText = `${r.daysLate} روز تأخیر`;
        if (kind === "upcoming" && r.daysAhead != null) statusText = `${r.daysAhead} روز بعد`;
        if (kind === "done") statusText = "انجام‌شده";
        tr.createEl("td", { text: statusText });

        // ستون منبع
        const srcCell = tr.createEl("td");
        if (r.item.source) {
          const srcBtn = srcCell.createEl("button", { text: "باز کردن" });
          srcBtn.setCssStyles({ fontSize: "11px", padding: "4px 8px" });
          srcBtn.onclick = () => this.openSourceInCurrentPane(r.item.source);
        } else {
          srcCell.textContent = "—";
        }

        // عملیات
        const ops = tr.createEl("td");
        if (kind !== "done") {
          const btn = ops.createEl("button", { text: "✔ انجام شد" });
          btn.setCssStyles({ background: "var(--interactive-accent)", color: "var(--text-on-accent)", border: "none", fontSize: "12px" });
          btn.onclick = () =>
            new ChecklistModal(this.app, this.plugin, r.item, r.review, async (cl) => {
              markCompleted(r.item, r.review.id);
              const rev = r.item.reviews.find((x: any) => x.id === r.review.id);
              if (rev) rev.checklistDone = cl;
              await this.plugin.saveItem(r.item);
              new Notice("مرور ثبت شد.");
              this.refresh();
            }).open();
            
          const snoozeBtn = ops.createEl("button", { text: "⏰ تعویق" });
          snoozeBtn.setCssStyles({ fontSize: "12px", color: "var(--text-warning)" });
          snoozeBtn.onclick = async () => {
            snoozeReview(r.item, r.review.id, 1);
            await this.plugin.saveItem(r.item);
            new Notice("به فردا موکول شد.");
            this.refresh();
          };
        }
        const detailsBtn = ops.createEl("button", { text: "جزئیات" });
        detailsBtn.setCssStyles({ fontSize: "12px" });
        detailsBtn.onclick = () => new ItemDetailsModal(this.app, this.plugin, r.item, () => this.refresh()).open();
      }
    }
  }
}
