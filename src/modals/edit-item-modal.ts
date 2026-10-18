import { App, Modal, Notice, Setting } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { ReviewItem } from "../models/review-item";
import { buildSchedule } from "../core/scheduler";
import { JalaliDatePickerModal } from "./jalali-datepicker";

export class EditItemModal extends Modal {
  private title: string;
  private subjectId: string;
  private learnedAt: string;
  private source: string;
  private rangeFrom: string;
  private rangeTo: string;
  private notes: string;

  constructor(app: App, private plugin: RecoveryEnginePlugin, private item: ReviewItem, private onChange: () => void) {
    super(app);
    this.title = item.title;
    this.subjectId = item.subjectId;
    this.learnedAt = item.learnedAt;
    this.source = item.source ?? "";
    this.rangeFrom = (item as unknown).rangeFrom ?? "";
    this.rangeTo = (item as unknown).rangeTo ?? "";
    this.notes = item.notes;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.setAttr("dir", "rtl");
    contentEl.createEl("h2", { text: "ویرایش مطلب" });

    new Setting(contentEl).setName("عنوان").addText((t) =>
      t.setValue(this.title).onChange((v) => (this.title = v))
    );

    const activeSubjects = this.plugin.settings.subjects.filter((s) => !s.archived);
    new Setting(contentEl).setName("درس").addDropdown((d) => {
      activeSubjects.forEach((s) => d.addOption(s.id, s.name));
      d.setValue(this.subjectId).onChange((v) => (this.subjectId = v));
    });

    new Setting(contentEl).setName("تاریخ یادگیری")
      .addButton((b) =>
        b.setButtonText(`تاریخ: ${this.learnedAt}`).onClick(() =>
          new JalaliDatePickerModal(this.app, this.learnedAt, (iso) => {
            this.learnedAt = iso;
            b.setButtonText(`تاریخ: ${iso}`);
          }).open()
        )
      );

    new Setting(contentEl).setName("منبع (لینک فایل)")
      .addText((t) => t.setValue(this.source).onChange((v) => (this.source = v)));
    new Setting(contentEl).setName("محدوده از")
      .addText((t) => t.setValue(this.rangeFrom).onChange((v) => (this.rangeFrom = v)));
    new Setting(contentEl).setName("محدوده تا")
      .addText((t) => t.setValue(this.rangeTo).onChange((v) => (this.rangeTo = v)));
    new Setting(contentEl).setName("یادداشت")
      .addTextArea((t) => t.setValue(this.notes).onChange((v) => (this.notes = v)));

    new Setting(contentEl).addButton((b) =>
      b.setButtonText("ذخیره").setCta().onClick(async () => {
        if (!this.title.trim()) { new Notice("عنوان الزامی است."); return; }
        const learnedChanged = this.learnedAt !== this.item.learnedAt;
        this.item.title = this.title.trim();
        this.item.subjectId = this.subjectId;
        this.item.source = this.source.trim();
        (this.item as unknown).rangeFrom = this.rangeFrom;
        (this.item as unknown).rangeTo = this.rangeTo;
        this.item.notes = this.notes;

        if (learnedChanged) {
          if (confirm("تاریخ یادگیری تغییر کرده. برنامه بازسازی شود؟")) {
            const fresh = buildSchedule(this.learnedAt, this.plugin.settings.schedule);
            const completedByLabel = new Map(this.item.reviews.filter((r) => r.completed).map((r) => [r.label, r] as const));
            this.item.reviews = fresh.map((r) => {
              const prev = completedByLabel.get(r.label);
              return prev && prev.completed ? { ...r, completed: true, completedAt: prev.completedAt } : r;
            });
            this.item.history.push({ at: new Date().toISOString(), type: "schedule-rebuilt", detail: "تغییر تاریخ یادگیری" });
          }
          this.item.learnedAt = this.learnedAt;
        }
        this.item.history.push({ at: new Date().toISOString(), type: "item-updated" });
        await this.plugin.saveItem(this.item);
        new Notice("ذخیره شد.");
        this.onChange();
        this.close();
      })
    ).addButton((b) => b.setButtonText("انصراف").onClick(() => this.close()));
  }

  onClose() { this.contentEl.empty(); }
}
