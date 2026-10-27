import { ItemView, WorkspaceLeaf, Notice, TFile, setIcon } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { computeBuckets, markCompleted, snoozeReview } from "../services/review-service";
import { AddItemModal } from "../modals/add-item-modal";
import { ChecklistModal } from "../modals/checklist-modal";
import { ItemDetailsModal } from "./item-details-modal";

export const DASHBOARD_VIEW_TYPE = "recovery-engine-dashboard";

// --- توابع تبدیل تاریخ شمسی (بدون وابستگی) ---
function gregorianToJalali(gy: number, gm: number, gd: number) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + (Math.floor((gy2 + 3) / 4)) - (Math.floor((gy2 + 99) / 100)) + (Math.floor((gy2 + 399) / 400)) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * (Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

function jalaliToGregorian(jy: number, jm: number, jd: number) {
  let gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  let days = (365 * jy) + ((Math.floor(jy / 33)) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * (Math.floor(days / 146097));
  days %= 146097;
  if (days > 36524) {
    gy += 100 * (Math.floor(--days / 36524));
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * (Math.floor(days / 1461));
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 1; gm <= 12; gm++) {
    if (gd <= sal_a[gm]) break;
    gd -= sal_a[gm];
  }
  return { gy, gm, gd };
}

function todayJalali() {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function formatJalali(jy: number, jm: number, jd: number) {
  return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
}

function isoToJalali(iso: string) {
  const [gy, gm, gd] = iso.split("-").map(Number);
  return gregorianToJalali(gy, gm, gd);
}

export class DashboardView extends ItemView {
  private sortTime: "asc" | "desc" | "none" = "none";
  private sortName: "asc" | "desc" | "none" = "none";

  // وضعیت تقویم
  private calYear: number;
  private calMonth: number;

  constructor(leaf: WorkspaceLeaf, private plugin: RecoveryEnginePlugin) {
    super(leaf);
    const t = todayJalali();
    this.calYear = t.jy;
    this.calMonth = t.jm;
  }

  getViewType() { return DASHBOARD_VIEW_TYPE; }
  getDisplayText() { return "Recovery Engine"; }
  getIcon() { return "calendar-check"; }

  async onOpen() { this.render(); }
  refresh() { this.render(); }

  private fmt(iso: string): string {
    const j = isoToJalali(iso);
    const weekDays = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
    const d = new Date(iso);
    return `${weekDays[d.getDay()]} ${formatJalali(j.jy, j.jm, j.jd)}`;
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

    // ✅ تقویم در بالای داشبورد
    await this.renderCalendar(container);

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

    // بخش تعویق‌شده‌ها
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

  // ✅ متد تقویم (شمسی)
  private async renderCalendar(container: HTMLElement) {
    const items = (await this.plugin.getItems()).filter(i => !i.deleted);
    const itemsByDate = new Map<string, any[]>();
    for (const item of items) {
      if (!itemsByDate.has(item.learnedAt)) itemsByDate.set(item.learnedAt, []);
      itemsByDate.get(item.learnedAt)!.push(item);
    }

    const calSection = container.createEl("section", { cls: "re-section" });
    calSection.setCssStyles({ marginBottom: "16px" });
    calSection.createEl("h3", { text: "📅 تقویم مباحث" });

    // هدر تقویم
    const calHeader = calSection.createEl("div", { cls: "re-cal-header" });
    calHeader.setCssStyles({ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" });

    const prevBtn = calHeader.createEl("button", { text: "‹" });
    prevBtn.onclick = () => {
      this.calMonth--;
      if (this.calMonth < 1) { this.calMonth = 12; this.calYear--; }
      this.refresh();
    };

    const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
    calHeader.createEl("h4", { text: `${monthNames[this.calMonth - 1]} ${this.calYear}` });

    const nextBtn = calHeader.createEl("button", { text: "›" });
    nextBtn.onclick = () => {
      this.calMonth++;
      if (this.calMonth > 12) { this.calMonth = 1; this.calYear++; }
      this.refresh();
    };

    // شبکه تقویم
    const grid = calSection.createEl("div", { cls: "re-cal-grid" });
    grid.setCssStyles({ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" });

    const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
    weekDays.forEach(d => {
      const cell = grid.createEl("div", { text: d });
      cell.setCssStyles({ textAlign: "center", fontWeight: "bold", padding: "6px", color: "var(--text-muted)", fontSize: "12px" });
    });

    // محاسبه روزهای ماه شمسی
    const daysInMonth = (this.calMonth <= 6) ? 31 : (this.calMonth <= 11 ? 30 : 29);
    
    // روز اول ماه شمسی چه روزی از هفته است؟
    const g = jalaliToGregorian(this.calYear, this.calMonth, 1);
    const firstDay = new Date(g.gy, g.gm - 1, g.gd);
    const startOffset = (firstDay.getDay() + 1) % 7; // شنبه=0

    for (let i = 0; i < startOffset; i++) {
      grid.createEl("div", { cls: "re-cal-cell empty" });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const gd = jalaliToGregorian(this.calYear, this.calMonth, d);
      const iso = `${gd.gy}-${String(gd.gm).padStart(2, "0")}-${String(gd.gd).padStart(2, "0")}`;
      
      const dayItems = itemsByDate.get(iso) || [];
      const cell = grid.createEl("div", { cls: "re-cal-cell" });
      cell.setCssStyles({
        minHeight: "60px",
        padding: "4px",
        background: dayItems.length > 0 ? "var(--background-modifier-hover)" : "var(--background-secondary)",
        border: "1px solid var(--background-modifier-border)",
        borderRadius: "6px",
        cursor: dayItems.length > 0 ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        position: "relative"
      });

      const dayNum = cell.createEl("div", { text: String(d) });
      dayNum.setCssStyles({ fontWeight: "bold", fontSize: "13px" });

      if (dayItems.length > 0) {
        const badge = cell.createEl("div", { text: String(dayItems.length) });
        badge.setCssStyles({ fontSize: "10px", background: "var(--interactive-accent)", color: "white", padding: "1px 5px", borderRadius: "8px", alignSelf: "flex-start" });

        cell.onclick = () => {
          const existing = calSection.querySelector(".re-cal-details");
          if (existing) existing.remove();
          
          const box = calSection.createEl("div", { cls: "re-cal-details" });
          box.setCssStyles({ marginTop: "12px", padding: "12px", background: "var(--background-secondary)", borderRadius: "8px" });
          box.createEl("h4", { text: `مباحث روز ${d} ${monthNames[this.calMonth - 1]} (${dayItems.length})` });
          const table = box.createEl("table", { cls: "re-table" });
          const head = table.createEl("tr");
          ["عنوان مبحث", "درس", "عملیات"].forEach(h => head.createEl("th", { text: h }));
          for (const item of dayItems) {
            const subject = this.plugin.settings.subjects.find((s: any) => s.id === item.subjectId);
            const row = table.createEl("tr");
            row.createEl("td", { text: item.title });
            row.createEl("td", { text: subject?.name ?? "—" });
            const ops = row.createEl("td");
            const btn = ops.createEl("button", { text: "جزئیات" });
            btn.onclick = () => new ItemDetailsModal(this.app, this.plugin, item, () => this.refresh()).open();
          }
        };
      }
    }
  }

  private async openSourceInCurrentPane(src: string) {
    const clean = src.trim();
    if (!clean) return;
    const file = this.app.vault.getAbstractFileByPath(clean);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
      return;
    }
    const wiki = clean.match(/^\[\[(.*?)\]\]$/);
    if (wiki) {
      const target = this.app.metadataCache.getFirstLinkpathDest(wiki[1], "");
      if (target) {
        await this.app.workspace.getLeaf(false).openFile(target);
        return;
      }
    }
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
      subSec.setCssStyles({ marginTop: "12px", border: "1px solid var(--background-modifier-border)", borderRadius: "8px", overflow: "hidden" });

      const subHeader = subSec.createEl("div", { cls: "re-subject-header" });
      subHeader.setCssStyles({ padding: "8px 12px", background: "var(--background-secondary)", borderBottom: "1px solid var(--background-modifier-border)", fontWeight: "700", color: "var(--text-accent)", fontSize: "13px" });
      subHeader.textContent = `${subjectName} (${subjRows.length} مرور)`;

      const table = subSec.createEl("table", { cls: "re-table" });
      table.setCssStyles({ margin: "0" });
      
      const head = table.createEl("tr");
      ["مبحث", "نوع مرور", "موعد", "وضعیت", "منبع", "عملیات"].forEach((h) => head.createEl("th", { text: h }));

      for (const r of subjRows) {
        const tr = table.createEl("tr");
        
        const titleCell = tr.createEl("td", { text: r.item.title });
        titleCell.setCssStyles({ cursor: "pointer" });
        titleCell.onclick = () => new ItemDetailsModal(this.app, this.plugin, r.item, () => this.refresh()).open();
          
        tr.createEl("td", { text: r.review.label });
        tr.createEl("td", { text: this.fmt(r.review.dueDate) });
        
        let statusText = "باقی‌مانده";
        if (kind === "overdue" && r.daysLate != null) statusText = `${r.daysLate} روز تأخیر`;
        if (kind === "upcoming" && r.daysAhead != null) statusText = `${r.daysAhead} روز بعد`;
        if (kind === "done") statusText = "انجام‌شده";
        tr.createEl("td", { text: statusText });

        const srcCell = tr.createEl("td");
        if (r.item.source) {
          const srcBtn = srcCell.createEl("button", { text: "باز کردن" });
          srcBtn.setCssStyles({ fontSize: "11px", padding: "3px 6px" });
          srcBtn.onclick = () => this.openSourceInCurrentPane(r.item.source);
        } else {
          srcCell.textContent = "—";
        }

        const ops = tr.createEl("td");
        if (kind !== "done") {
          const btn = ops.createEl("button", { text: "✔ انجام شد" });
          btn.setCssStyles({ background: "var(--interactive-accent)", color: "var(--text-on-accent)", border: "none", fontSize: "11px" });
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
          snoozeBtn.setCssStyles({ fontSize: "11px", color: "var(--text-warning)" });
          snoozeBtn.onclick = async () => {
            snoozeReview(r.item, r.review.id, 1);
            await this.plugin.saveItem(r.item);
            new Notice("به فردا موکول شد.");
            this.refresh();
          };
        }
        const detailsBtn = ops.createEl("button", { text: "جزئیات" });
        detailsBtn.setCssStyles({ fontSize: "11px" });
        detailsBtn.onclick = () => new ItemDetailsModal(this.app, this.plugin, r.item, () => this.refresh()).open();
      }
    }
  }
}
