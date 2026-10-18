import { App, Modal } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { ReviewItem, ReviewSession } from "../models/review-item";

export class ChecklistModal extends Modal {
  private done: Set<string>;

  constructor(
    app: App,
    private plugin: RecoveryEnginePlugin,
    private item: ReviewItem,
    private review: ReviewSession,
    private onConfirm: (checklist: string[]) => void
  ) {
    super(app);
    this.done = new Set(review.checklistDone ?? []);
  }

  onOpen() {
    const { contentEl, modalEl } = this;

    modalEl.addClass("re-checklist-modal");
    contentEl.addClass("re-checklist-content");
    contentEl.setAttr("dir", "rtl");

    contentEl.empty();
    contentEl.createEl("h2", { text: `مرور: ${this.review.label}` });
    const sub = contentEl.createEl("p", { text: this.item.title, cls: "re-checklist-sub" });

    const subject = this.plugin.settings.subjects.find(
      (s) => s.id === this.item.subjectId
    );
    const checklist = subject?.checklist ?? [];

    if (checklist.length === 0) {
      contentEl.createEl("p", {
        text: "چک‌لیستی برای این درس تعریف نشده. می‌توانی مستقیم ثبت کنی.",
      });
    } else {
      const list = contentEl.createDiv({ cls: "re-checklist-list" });
      for (const line of checklist) {
        const row = list.createEl("label", { cls: "re-checklist-row" });
        const cb = row.createEl("input", { type: "checkbox" });
        cb.checked = this.done.has(line);
        cb.onchange = () => {
          if (cb.checked) this.done.add(line);
          else this.done.delete(line);
        };
        const txt = row.createSpan({ text: line, cls: "re-checklist-text" });
      }
    }

    // فوتر ثابت
    const footer = modalEl.createDiv({ cls: "re-checklist-footer" });
    const cancel = footer.createEl("button", { text: "انصراف" });
    cancel.onclick = () => this.close();

    const ok = footer.createEl("button", { text: "انجام شد", cls: "mod-cta" });
    ok.onclick = () => {
      this.onConfirm(Array.from(this.done));
      this.close();
    };
  }

  onClose() { this.contentEl.empty(); }
}
