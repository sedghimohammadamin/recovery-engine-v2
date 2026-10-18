import { App, Modal, Notice, Setting } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { ReviewItem } from "../models/review-item";
import { buildSchedule } from "../core/scheduler";
import { todayISO } from "../core/date-utils";
import { JalaliDatePickerModal } from "./jalali-datepicker";

export class AddItemModal extends Modal {
  private title = "";
  private subjectId: string;
  private learnedAt = todayISO();
  private source = "";
  private rangeFrom = "";
  private rangeTo = "";
  private notes = "";

  constructor(app: App, private plugin: RecoveryEnginePlugin) {
    super(app);
    this.subjectId = plugin.settings.subjects.find((s) => !s.archived)?.id ?? plugin.settings.subjects[0]?.id ?? "";
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.setAttr("dir", "rtl");
    contentEl.createEl("h2", { text: "ثبت مطلب جدید" });

    new Setting(contentEl).setName("عنوان مبحث").addText((t) =>
      t.setPlaceholder("مثلاً: مفهوم شرط").onChange((v) => (this.title = v))
    );

    const activeSubjects = this.plugin.settings.subjects.filter((s) => !s.archived);
    new Setting(contentEl).setName("درس").addDropdown((d) => {
      activeSubjects.forEach((s) => d.addOption(s.id, s.name));
      d.setValue(this.subjectId).onChange((v) => (this.subjectId = v));
    });

    new Setting(contentEl).setName("تاریخ یادگیری")
      .addButton((b) =>
        b.setButtonText("انتخاب تاریخ شمسی").onClick(() =>
          new JalaliDatePickerModal(this.app, this.learnedAt, (iso) => {
            this.learnedAt = iso;
            b.setButtonText(`تاریخ: ${iso}`);
          }).open()
        )
      )
      .addButton((b) =>
        b.setButtonText("امروز").onClick(() => {
          this.learnedAt = todayISO();
          b.setButtonText("امروز انتخاب شد");
        })
      );

    new Setting(contentEl)
      .setName("منبع (لینک فایل جزوه)")
      .setDesc("مسیر فایل یا لینک [[فایل]]")
      .addText((t) => {
        t.setPlaceholder("مثلاً: [[جزوات/فقه۱/جلسه۳]]");
        t.setValue(this.source);
        t.onChange((v) => (this.source = v));
      });

    new Setting(contentEl).setName("محدوده از").addText((t) =>
      t.setPlaceholder("مثلاً: صفحه ۱۲").onChange((v) => (this.rangeFrom = v))
    );
    new Setting(contentEl).setName("محدوده تا").addText((t) =>
      t.setPlaceholder("مثلاً: صفحه ۱۸").onChange((v) => (this.rangeTo = v))
    );
    new Setting(contentEl).setName("یادداشت").addTextArea((t) =>
      t.onChange((v) => (this.notes = v))
    );

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
          rangeFrom: this.rangeFrom,
          rangeTo: this.rangeTo,
          notes: this.notes,
          customFields: {},
          reviews,
          history: [{ at: new Date().toISOString(), type: "item-created" }],
          archived: false,
        };
        await this.plugin.addItem(item);
        new Notice(`«${item.title}» ثبت شد (${reviews.length} مرور).`);
        this.close();
      })
    );
  }

  onClose() { this.contentEl.empty(); }
}
