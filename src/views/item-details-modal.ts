import { App, Modal, Notice, Setting, TFile } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { ReviewItem } from "../models/review-item";
import { markCompleted, reopenReview } from "../services/review-service";
import { ChecklistModal } from "../modals/checklist-modal";
import { EditItemModal } from "../modals/edit-item-modal";
import { formatWithWeekday } from "../core/persian-bridge";

export class ItemDetailsModal extends Modal {
  constructor(
    app: App,
    private plugin: RecoveryEnginePlugin,
    private item: ReviewItem,
    private onChange: () => void
  ) { super(app); }

  private fmt(d: string | null): string {
    if (!d) return "—";
    return formatWithWeekday(this.app, d, this.plugin.settings.dateFormat);
  }

  async openSource(src: string) {
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

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.setAttr("dir", "rtl");

    modalEl.addClass("re-detail-modal");
    contentEl.addClass("re-detail-content");

    const subject = this.plugin.settings.subjects.find((s) => s.id === this.item.subjectId);
    contentEl.createEl("h2", { text: this.item.title });
    contentEl.createEl("p", {
      text: `درس: ${subject?.name ?? "—"} | تاریخ یادگیری: ${this.fmt(this.item.learnedAt)}`,
    });

    if (this.item.source) {
      const row = contentEl.createDiv({ cls: "re-source-row" });
      row.createSpan({ text: "منبع:" });
      const openBtn = row.createEl("button", { text: "باز کردن" });
      openBtn.onclick = () => this.openSource(this.item.source);
    }

    const rangeFrom = (this.item as unknown).rangeFrom ?? "";
    const rangeTo = (this.item as unknown).rangeTo ?? "";
    if (rangeFrom || rangeTo) {
      contentEl.createEl("p", { text: `محدوده: ${rangeFrom || "?"} تا ${rangeTo || "?"}` });
    }
    if (this.item.notes) contentEl.createEl("p", { text: `یادداشت: ${this.item.notes}` });

    contentEl.createEl("h3", { text: "برنامهٔ مرور" });
    const table = contentEl.createEl("table", { cls: "re-table" });
    const head = table.createEl("tr");
    ["مرحله", "موعد", "وضعیت", "تاریخ انجام", "عملیات"].forEach((h) => head.createEl("th", { text: h }));
    for (const r of this.item.reviews) {
      const row = table.createEl("tr");
      row.createEl("td", { text: r.label });
      row.createEl("td", { text: this.fmt(r.dueDate) });
      row.createEl("td", { text: r.completed ? "انجام‌شده" : "باقی‌مانده" });
      row.createEl("td", { text: r.completedAt ? this.fmt(r.completedAt.slice(0, 10)) : "—" });
      const ops = row.createEl("td");
      if (!r.completed) {
        const btn = ops.createEl("button", { text: "انجام شد" });
        btn.onclick = () =>
          new ChecklistModal(this.app, this.plugin, this.item, r, async (cl) => {
            markCompleted(this.item, r.id);
            const rev = this.item.reviews.find((x) => x.id === r.id);
            if (rev) rev.checklistDone = cl;
            await this.plugin.saveItem(this.item);
            new Notice("مرور ثبت شد.");
            this.onChange();
            this.onOpen();
          }).open();
      } else {
        const btn = ops.createEl("button", { text: "بازگرداندن" });
        btn.onclick = async () => {
          reopenReview(this.item, r.id);
          await this.plugin.saveItem(this.item);
          this.onChange();
          this.onOpen();
        };
      }
      const del = ops.createEl("button", { text: "حذف" });
      del.onclick = async () => {
        if (!confirm(`مرور «${r.label}» حذف شود؟`)) return;
        this.item.reviews = this.item.reviews.filter((x) => x.id !== r.id);
        await this.plugin.saveItem(this.item);
        this.onChange();
        this.onOpen();
      };
    }

    contentEl.createEl("h3", { text: "تاریخچه" });
    const hist = contentEl.createEl("ul");
    this.item.history.slice().reverse().forEach((h) =>
      hist.createEl("li", {
        text: `${this.fmt(h.at.slice(0, 10))} — ${h.type}${h.detail ? ` (${h.detail})` : ""}`,
      })
    );

    const footer = contentEl.createDiv({ cls: "re-detail-footer" });
    new Setting(footer)
      .addButton((b) => b.setButtonText("ویرایش").onClick(() =>
        new EditItemModal(this.app, this.plugin, this.item, () => { this.onChange(); this.onOpen(); }).open()
      ))
      .addButton((b) => b.setButtonText(this.item.archived ? "خروج از بایگانی" : "بایگانی").onClick(async () => {
        this.item.archived = !this.item.archived;
        this.item.history.push({ at: new Date().toISOString(), type: this.item.archived ? "item-archived" : "item-unarchived" });
        await this.plugin.saveItem(this.item);
        this.onChange();
        this.close();
      }))
      .addButton((b) => b.setButtonText("بستن").onClick(() => this.close()));
  }

  onClose() { this.contentEl.empty(); }
}
