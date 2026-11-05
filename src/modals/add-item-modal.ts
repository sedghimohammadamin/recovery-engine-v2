import { App, Modal, Notice, Setting } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { ReviewItem } from "../models/review-item";
import { buildSchedule } from "../core/scheduler";
import { todayISO } from "../core/date-utils";
import { toJalali, jalaliMonthName } from "../core/persian-bridge";
import { JalaliDatePickerModal } from "./jalali-datepicker";
import { renderJalaliCalendar } from "../views/calendar-view";

export class AddItemModal extends Modal {
  private title = "";
  private subjectId: string;
  private learnedAt = todayISO();
  private source = "";
  private sourceBlockId = "";
  private rangeFrom = "";
  private rangeTo = "";
  private notes = "";
  private dateLabelEl: HTMLElement | null = null;
  private previewYear = 0;
  private previewMonth = 0;

  constructor(app: App, private plugin: RecoveryEnginePlugin) {
    super(app);
    this.subjectId = plugin.settings.subjects.find((s) => !s.archived)?.id ?? plugin.settings.subjects[0]?.id ?? "";
    const now = new Date();
    const j = toJalali(app, now.getFullYear(), now.getMonth() + 1, now.getDate());
    this.previewYear = j.jy;
    this.previewMonth = j.jm;
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.setAttr("dir", "rtl");
    modalEl.addClass("re-add-modal");
    contentEl.addClass("re-add-content");

    contentEl.createEl("h2", { text: "ثبت مطلب جدید" });

    new Setting(contentEl).setName("عنوان مبحث").addText((t) =>
      t.setPlaceholder("مثلاً: مفهوم شرط").onChange((v) => (this.title = v))
    );

    const activeSubjects = this.plugin.settings.subjects.filter((s) => !s.archived);
    new Setting(contentEl).setName("درس").addDropdown((d) => {
      activeSubjects.forEach((s) => d.addOption(s.id, s.name));
      d.setValue(this.subjectId).onChange((v) => (this.subjectId = v));
    });

    // تاریخ یادگیری
    const dateSetting = new Setting(contentEl).setName("تاریخ یادگیری");
    const dateRow = dateSetting.controlEl.createEl("div");
    dateRow.setCssStyles({ display: "flex", gap: "8px" });

    const todayBtn = dateRow.createEl("button", { text: "امروز" });
    todayBtn.onclick = () => {
      this.learnedAt = todayISO();
      this.updateDateLabel();
      this.updatePreview(calWrapper);
    };

    const pickBtn = dateRow.createEl("button", { text: "انتخاب از تقویم" });
    pickBtn.onclick = () => {
      new JalaliDatePickerModal(this.app, this.learnedAt, (iso) => {
        this.learnedAt = iso;
        this.updateDateLabel();
        this.updatePreview(calWrapper);
      }).open();
    };

    this.dateLabelEl = contentEl.createEl("div", { cls: "re-date-label" });
    this.dateLabelEl.setCssStyles({ marginBottom: "16px", fontSize: "14px", color: "var(--text-accent)" });
    this.updateDateLabel();

    // منبع
    new Setting(contentEl).setName("منبع").addText((t) => t.setValue(this.source).onChange((v) => (this.source = v)));
    new Setting(contentEl).setName("بلاک آیدی").setDesc("اختیاری: برای لینک به یک بلاک خاص (مثلاً firstblock)").addText((t) => t.setValue(this.sourceBlockId).onChange((v) => (this.sourceBlockId = v)));
    
    new Setting(contentEl).setName("محدوده از").addText((t) => t.onChange((v) => (this.rangeFrom = v)));
    new Setting(contentEl).setName("محدوده تا").addText((t) => t.onChange((v) => (this.rangeTo = v)));
    new Setting(contentEl).setName("یادداشت").addTextArea((t) => t.onChange((v) => (this.notes = v)));

    // پیش‌نمایش
    contentEl.createEl("h3", { text: "پیش‌نمایش برنامه مرور" });
    const calWrapper = contentEl.createEl("div", { cls: "re-preview-cal-wrapper" });
    calWrapper.setCssStyles({ padding: "12px", background: "var(--background-secondary)", borderRadius: "10px", marginBottom: "16px" });
    this.updatePreview(calWrapper);

    // دکمه ثبت
    new Setting(contentEl).addButton((b) =>
      b.setButtonText("ثبت").setCta().onClick(async () => {
        if (!this.title.trim()) { new Notice("عنوان الزامی است."); return; }
        if (!this.subjectId) { new Notice("درس را انتخاب کنید."); return; }
        const reviews = buildSchedule(this.learnedAt, this.plugin.settings.schedule);
        const item: ReviewItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          subjectId: this.subjectId,
          title: this.title.trim(),
          learnedAt: this.learnedAt,
          source: this.source.trim(),
          sourceBlockId: this.sourceBlockId.trim() || undefined,
          rangeFrom: this.rangeFrom,
          rangeTo: this.rangeTo,
          notes: this.notes,
          customFields: {},
          reviews,
          history: [{ at: new Date().toISOString(), type: "item-created" }],
          archived: false,
        };
        await this.plugin.addItem(item);
        new Notice(`«${item.title}» ثبت شد.`);
        this.close();
      })
    );
  }

  private updateDateLabel() {
    if (!this.dateLabelEl) return;
    const [gy, gm, gd] = this.learnedAt.split("-").map(Number);
    const j = toJalali(this.app, gy, gm, gd);
    this.previewYear = j.jy;
    this.previewMonth = j.jm;
    const weekDays = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
    const d = new Date(gy, gm - 1, gd);
    this.dateLabelEl.textContent = `تاریخ انتخاب‌شده: ${weekDays[d.getDay()]} ${j.jd} ${jalaliMonthName(this.app, j.jm)} ${j.jy}`;
  }

  private updatePreview(container: HTMLElement, year?: number, month?: number) {
    if (year !== undefined) this.previewYear = year;
    if (month !== undefined) this.previewMonth = month;

    container.empty();
    const reviews = buildSchedule(this.learnedAt, this.plugin.settings.schedule);
    
    const allDates = reviews.map(r => r.dueDate).sort();
    const rangeStart = this.learnedAt;
    const rangeEnd = allDates.length > 0 ? allDates[allDates.length - 1] : this.learnedAt;

    renderJalaliCalendar(this.app, container, this.previewYear, this.previewMonth, {
      reviews: reviews,
      learnedAt: this.learnedAt,
      cellHeight: "45px",
      rangeStart: rangeStart,
      rangeEnd: rangeEnd,
      onMonthChange: (y, m) => {
        // ذخیره موقعیت اسکرول
        const scrollTop = this.contentEl.scrollTop;
        
        // رندر مجدد تقویم
        this.updatePreview(container, y, m);
        
        // بازگرداندن موقعیت اسکرول در فریم بعدی
        window.requestAnimationFrame(() => {
          this.contentEl.scrollTop = scrollTop;
        });
      }
    });
  }

  onClose() { this.contentEl.empty(); }
}
