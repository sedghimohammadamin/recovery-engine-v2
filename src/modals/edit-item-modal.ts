import { App, Modal, Notice, Setting } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { ReviewItem } from "../models/review-item";
import { buildSchedule } from "../core/scheduler";
import { toJalali, jalaliMonthName } from "../core/persian-bridge";
import { JalaliDatePickerModal } from "./jalali-datepicker";

export class EditItemModal extends Modal {
  private title: string;
  private subjectId: string;
  private learnedAt: string;
  private source: string;
  private sourceBlockId: string;
  private rangeFrom: string;
  private rangeTo: string;
  private notes: string;
  private dateLabelEl: HTMLElement | null = null;

  constructor(
    app: App,
    private plugin: RecoveryEnginePlugin,
    private item: ReviewItem,
    private onChange: () => void
  ) {
    super(app);
    this.title = item.title;
    this.subjectId = item.subjectId;
    this.learnedAt = item.learnedAt;
    this.source = item.source ?? "";
    this.sourceBlockId = item.sourceBlockId ?? "";
    this.rangeFrom = item.rangeFrom ?? "";
    this.rangeTo = item.rangeTo ?? "";
    this.notes = item.notes;
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.setAttr("dir", "rtl");
    modalEl.addClass("re-add-modal");
    contentEl.addClass("re-add-content");

    contentEl.createEl("h2", { text: "ویرایش مطلب" });

    new Setting(contentEl).setName("عنوان مبحث").addText((t) =>
      t.setValue(this.title).onChange((v) => (this.title = v))
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
      const now = new Date();
      this.learnedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      this.updateDateLabel();
    };

    const pickBtn = dateRow.createEl("button", { text: "انتخاب از تقویم" });
    pickBtn.onclick = () => {
      new JalaliDatePickerModal(this.app, this.learnedAt, (iso) => {
        this.learnedAt = iso;
        this.updateDateLabel();
      }).open();
    };

    this.dateLabelEl = contentEl.createEl("div", { cls: "re-date-label" });
    this.dateLabelEl.setCssStyles({ marginBottom: "16px", fontSize: "14px", color: "var(--text-accent)" });
    this.updateDateLabel();

    // منبع
    new Setting(contentEl).setName("منبع (لینک فایل)").addText((t) =>
      t.setValue(this.source).onChange((v) => (this.source = v))
    );
    new Setting(contentEl).setName("بلاک آیدی").setDesc("اختیاری: برای لینک به یک بلاک خاص (مثلاً firstblock)").addText((t) =>
      t.setValue(this.sourceBlockId).onChange((v) => (this.sourceBlockId = v))
    );
    
    new Setting(contentEl).setName("محدوده از").addText((t) =>
      t.setValue(this.rangeFrom).onChange((v) => (this.rangeFrom = v))
    );
    new Setting(contentEl).setName("محدوده تا").addText((t) =>
      t.setValue(this.rangeTo).onChange((v) => (this.rangeTo = v))
    );
    new Setting(contentEl).setName("یادداشت").addTextArea((t) =>
      t.setValue(this.notes).onChange((v) => (this.notes = v))
    );

    new Setting(contentEl)
      .addButton((b) =>
        b.setButtonText("ذخیره").setCta().onClick(async () => {
          if (!this.title.trim()) { new Notice("عنوان الزامی است."); return; }
          
          const learnedChanged = this.learnedAt !== this.item.learnedAt;
          this.item.title = this.title.trim();
          this.item.subjectId = this.subjectId;
          this.item.source = this.source.trim();
          this.item.sourceBlockId = this.sourceBlockId.trim() || undefined;
          this.item.rangeFrom = this.rangeFrom;
          this.item.rangeTo = this.rangeTo;
          this.item.notes = this.notes;

          if (learnedChanged) {
            if (confirm("تاریخ یادگیری تغییر کرده. برنامه مرور بازسازی شود؟")) {
              const fresh = buildSchedule(this.learnedAt, this.plugin.settings.schedule);
              const completedByLabel = new Map(
                this.item.reviews.filter((r) => r.completed).map((r) => [r.label, r] as const)
              );
              this.item.reviews = fresh.map((r) => {
                const prev = completedByLabel.get(r.label);
                if (prev && prev.completed) {
                  return { ...r, completed: true, completedAt: prev.completedAt };
                }
                return r;
              });
              this.item.history.push({
                at: new Date().toISOString(),
                type: "schedule-rebuilt",
                detail: "تغییر تاریخ یادگیری",
              });
            }
            this.item.learnedAt = this.learnedAt;
          }

          this.item.history.push({ at: new Date().toISOString(), type: "item-updated" });
          await this.plugin.saveItem(this.item);
          new Notice("ذخیره شد.");
          this.onChange();
          this.close();
        })
      )
      .addButton((b) => b.setButtonText("انصراف").onClick(() => this.close()));
  }

  private updateDateLabel() {
    if (!this.dateLabelEl) return;
    const [gy, gm, gd] = this.learnedAt.split("-").map(Number);
    const j = toJalali(this.app, gy, gm, gd);
    const weekDays = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
    const d = new Date(gy, gm - 1, gd);
    this.dateLabelEl.textContent = `تاریخ انتخاب‌شده: ${weekDays[d.getDay()]} ${j.jd} ${jalaliMonthName(this.app, j.jm)} ${j.jy}`;
  }

  onClose() { this.contentEl.empty(); }
}
