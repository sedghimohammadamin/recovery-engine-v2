import { App, Modal, Notice, Setting, TFile } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { ReviewItem } from "../models/review-item";
import { markCompleted, reopenReview, snoozeReview } from "../services/review-service";
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
    const { modalEl } = this;
    modalEl.empty();

    // ۱. تنظیمات مودال
    modalEl.addClass("re-detail-modal");
    modalEl.setCssStyles({
      width: "700px",
      height: "600px",
      maxWidth: "95vw",
      maxHeight: "92vh",
      position: "relative",
      display: "flex",
      flexDirection: "column",
      padding: "0",
      overflow: "hidden"
    });

    // ۲. ساخت wrapper اصلی
    const wrapper = modalEl.createEl("div");
    wrapper.setCssStyles({
      display: "flex",
      flexDirection: "column",
      width: "100%",
      height: "100%",
      position: "relative"
    });

    // ۳. بخش محتوا (اسکرول‌شونده)
    const body = wrapper.createEl("div", { cls: "re-detail-content" });
    body.setCssStyles({
      flex: "1",
      overflowY: "auto",
      padding: "24px",
      direction: "rtl"
    });

    // ۴. فوتر ثابت (بیرون از اسکرول)
    const footer = wrapper.createEl("div", { cls: "re-detail-footer" });
    footer.setCssStyles({
      padding: "16px 24px",
      background: "var(--background-secondary)",
      borderTop: "1px solid var(--background-modifier-border)",
      flexShrink: "0",
      display: "flex",
      justifyContent: "flex-end",
      gap: "10px"
    });

    // ۵. دستگیرهٔ ریسایز
    const handle = modalEl.createEl("div", { cls: "re-resize-handle" });
    let resizing = false;
    let startX = 0, startY = 0, startW = 0, startH = 0;

    handle.addEventListener("mousedown", (e) => {
      e.preventDefault(); e.stopPropagation();
      resizing = true;
      startX = e.clientX; startY = e.clientY;
      const rect = modalEl.getBoundingClientRect();
      startW = rect.width; startH = rect.height;
      document.body.setCssStyles({ cursor: "nwse-resize" });
    });

    const onMove = (e: MouseEvent) => {
      if (!resizing) return;
      const dx = startX - e.clientX;
      const dy = e.clientY - startY;
      const newW = Math.max(450, Math.min(window.innerWidth * 0.95, startW + dx));
      const newH = Math.max(350, Math.min(window.innerHeight * 0.92, startH + dy));
      modalEl.style.width = `${newW}px`;
      modalEl.style.height = `${newH}px`;
    };

    const onUp = () => {
      if (!resizing) return;
      resizing = false;
      document.body.setCssStyles({ cursor: "" });
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    (this as any)._cleanupResize = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    // ============ محتوا ============
    const subject = this.plugin.settings.subjects.find((s) => s.id === this.item.subjectId);
    body.createEl("h2", { text: this.item.title });
    body.createEl("p", {
      text: `درس: ${subject?.name ?? "—"} | تاریخ یادگیری: ${this.fmt(this.item.learnedAt)}`,
    });

    if (this.item.source) {
      const row = body.createEl("div", { cls: "re-source-row" });
      row.createEl("span", { text: "منبع:" });
      const openBtn = row.createEl("button", { text: "باز کردن" });
      openBtn.onclick = () => this.openSource(this.item.source);
    }

    const rangeFrom = (this.item as any).rangeFrom ?? "";
    const rangeTo = (this.item as any).rangeTo ?? "";
    if (rangeFrom || rangeTo) {
      body.createEl("p", { text: `محدوده: ${rangeFrom || "?"} تا ${rangeTo || "?"}` });
    }
    if (this.item.notes) body.createEl("p", { text: `یادداشت: ${this.item.notes}` });

    body.createEl("h3", { text: "برنامهٔ مرور" });
    const table = body.createEl("table", { cls: "re-table" });
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

        const snoozeBtn = ops.createEl("button", { text: "فردا" });
        snoozeBtn.onclick = async () => {
          snoozeReview(this.item, r.id, 1);
          await this.plugin.saveItem(this.item);
          new Notice("به فردا موکول شد.");
          this.onChange();
          this.onOpen();
        };
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

    body.createEl("h3", { text: "تاریخچه" });
    const hist = body.createEl("ul");
    this.item.history.slice().reverse().forEach((h) =>
      hist.createEl("li", {
        text: `${this.fmt(h.at.slice(0, 10))} — ${h.type}${h.detail ? ` (${h.detail})` : ""}`,
      })
    );

    // فوتر
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
