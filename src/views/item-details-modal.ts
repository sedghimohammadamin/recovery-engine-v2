import { App, Modal, Notice, Setting, TFile } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { ReviewItem } from "../models/review-item";
import { markCompleted, reopenReview } from "../services/review-service";
import { ChecklistModal } from "../modals/checklist-modal";
import { EditItemModal } from "../modals/edit-item-modal";
import { formatDateForDisplay } from "../core/persian-bridge";
import { toJalali } from "../core/persian-bridge";
import { renderJalaliCalendar } from "./calendar-view";

export class ItemDetailsModal extends Modal {
  private calYear = 0;
  private calMonth = 0;
  private calendarContainer: HTMLElement | null = null;

  constructor(
    app: App,
    private plugin: RecoveryEnginePlugin,
    private item: ReviewItem,
    private onChange: () => void
  ) {
    super(app);
    // شروع از ماه تاریخ یادگیری
    const [gy, gm, gd] = this.item.learnedAt.split("-").map(Number);
    const j = toJalali(app, gy, gm, gd);
    this.calYear = j.jy;
    this.calMonth = j.jm;
  }

  private fmt(d: string | null): string {
    if (!d) return "—";
    return formatDateForDisplay(this.app, d, this.plugin.settings.dateFormat);
  }

  async openSource(src: string) {
    const clean = src.trim();
    if (!clean) return;
    
    // پیدا کردن فایل بدون بلاک‌آیدی
    let filePath = clean;
    let blockId: string | null = null;
    
    const match = clean.match(/^(.*?)(?:%23%5E|#\^)(.*?)$/);
    if (match) {
      filePath = match[1];
      blockId = match[2];
    }
    
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
      if (blockId) {
        // رفتن به بلاک خاص
        await (this.app.workspace as any).openLinkText(`${filePath}#^${blockId}`, "", false);
      }
      return;
    }
    
    new Notice("فایل منبع پیدا نشد.");
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.setAttr("dir", "rtl");

    modalEl.addClass("re-detail-modal");
    modalEl.setCssStyles({ width: "700px", height: "600px", maxWidth: "95vw", maxHeight: "92vh" });

    contentEl.addClass("re-detail-content");
    contentEl.setCssStyles({ overflowY: "auto", flex: "1", padding: "24px" });

    const subject = this.plugin.settings.subjects.find((s) => s.id === this.item.subjectId);
    contentEl.createEl("h2", { text: this.item.title });
    contentEl.createEl("p", {
      text: `درس: ${subject?.name ?? "—"} | تاریخ یادگیری: ${this.fmt(this.item.learnedAt)}`,
    });

    if (this.item.source) {
      const row = contentEl.createEl("div", { cls: "re-source-row" });
      row.createEl("span", { text: "منبع:" });
      const openBtn = row.createEl("button", { text: "باز کردن" });
      openBtn.onclick = () => this.openSource(this.item.source);
    }

    if (this.item.sourceBlockId) {
      contentEl.createEl("p", { text: `بلاک آیدی: ${this.item.sourceBlockId}` });
    }

    const rangeFrom = this.item.rangeFrom ?? "";
    const rangeTo = this.item.rangeTo ?? "";
    if (rangeFrom || rangeTo) {
      contentEl.createEl("p", { text: `محدوده: ${rangeFrom || "?"} تا ${rangeTo || "?"}` });
    }
    if (this.item.notes) contentEl.createEl("p", { text: `یادداشت: ${this.item.notes}` });

    // ============ تقویم پیش‌نمایش ============
    contentEl.createEl("h3", { text: "📅 برنامه مرور" });
    
    // افسانه
    const legend = contentEl.createEl("div");
    legend.setCssStyles({ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap", fontSize: "11px" });
    const KIND_LABELS: Record<string, string> = {
      initial: "مرور اولیه",
      weekend: "مرور هفتگی",
      monthly: "مرور ماهانه",
      longterm: "مرور بلندمدت",
    };
    const KIND_COLORS: Record<string, string> = {
      initial: "#3b82f6",
      weekend: "#10b981",
      monthly: "#f59e0b",
      longterm: "#ef4444",
    };
    for (const [kind, label] of Object.entries(KIND_LABELS)) {
      const item = legend.createEl("div");
      item.setCssStyles({ display: "flex", alignItems: "center", gap: "4px" });
      
      // فیل (انجام‌نشده)
      const fill = item.createEl("div");
      fill.setCssStyles({ width: "14px", height: "14px", borderRadius: "3px", background: KIND_COLORS[kind], border: `1px solid ${KIND_COLORS[kind]}` });
      item.createEl("span", { text: `${label} (باقی‌مانده)` });
      
      // استروک (انجام‌شده)
      const stroke = item.createEl("div");
      stroke.setCssStyles({ width: "14px", height: "14px", borderRadius: "3px", background: "transparent", border: `2px solid ${KIND_COLORS[kind]}`, marginLeft: "8px" });
      item.createEl("span", { text: "انجام‌شده" });
    }

    this.calendarContainer = contentEl.createEl("div");
    this.calendarContainer.setCssStyles({ padding: "12px", background: "var(--background-secondary)", borderRadius: "10px" });
    this.updateCalendar();

    // ============ تاریخچه ============
    contentEl.createEl("h3", { text: "تاریخچه" });
    const hist = contentEl.createEl("ul");
    this.item.history.slice().reverse().forEach((h) =>
      hist.createEl("li", {
        text: `${this.fmt(h.at.slice(0, 10))} — ${h.type}${h.detail ? ` (${h.detail})` : ""}`,
      })
    );

    // ============ دکمه‌ها ============
    const footer = contentEl.createEl("div", { cls: "re-detail-footer" });
    new Setting(footer)
      .addButton((b) =>
        b.setButtonText("ویرایش").onClick(() =>
          new EditItemModal(this.app, this.plugin, this.item, () => {
            this.onChange();
            this.onOpen();
          }).open()
        )
      )
      .addButton((b) =>
        b.setButtonText(this.item.archived ? "خروج از بایگانی" : "بایگانی").onClick(async () => {
          this.item.archived = !this.item.archived;
          this.item.history.push({
            at: new Date().toISOString(),
            type: this.item.archived ? "item-archived" : "item-unarchived",
          });
          await this.plugin.saveItem(this.item);
          this.onChange();
          this.close();
        })
      )
      .addButton((b) => b.setButtonText("بستن").onClick(() => this.close()));
  }

  private updateCalendar() {
    if (!this.calendarContainer) return;
    
    // پیدا کردن بازه مرورها
    const allDates = this.item.reviews.map(r => r.dueDate).sort();
    const rangeStart = this.item.learnedAt;
    const rangeEnd = allDates.length > 0 ? allDates[allDates.length - 1] : this.item.learnedAt;

    renderJalaliCalendar(this.app, this.calendarContainer, this.calYear, this.calMonth, {
      reviews: this.item.reviews,
      learnedAt: this.item.learnedAt,
      cellHeight: "55px",
      rangeStart: rangeStart,
      rangeEnd: rangeEnd,
      completedMode: true,
      onMonthChange: (y, m) => {
        this.calYear = y;
        this.calMonth = m;
        this.updateCalendar();
      }
    });
  }

  onClose() { this.contentEl.empty(); }
}
