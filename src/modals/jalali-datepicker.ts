import { App, Modal } from "obsidian";
import { toJalali, toGregorian, jalaliMonthName } from "../core/persian-bridge";

export class JalaliDatePickerModal extends Modal {
  private jy: number;
  private jm: number;
  private jd: number;
  private headerEl: HTMLElement | null = null;
  private gridEl: HTMLElement | null = null;

  constructor(app: App, private initialIso: string, private onPick: (iso: string) => void) {
    super(app);
    // استفاده از toJalali مطمئن، اگر تاریخ خراب بود، تاریخ امروز را بگیر
    let iso = initialIso;
    if (!iso || iso.split("-").length !== 3) {
      const now = new Date();
      iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }
    const [gy, gm, gd] = iso.split("-").map(Number);
    const j = toJalali(app, gy, gm, gd);
    this.jy = Number(j.jy);
    this.jm = Number(j.jm);
    this.jd = Number(j.jd);
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.setAttr("dir", "rtl");
    modalEl.addClass("re-datepicker-modal");
    contentEl.addClass("re-datepicker-content");

    contentEl.createEl("h2", { text: "انتخاب تاریخ" });

    // دکمه امروز
    const todayBtn = contentEl.createEl("button", { text: "امروز" });
    todayBtn.setCssStyles({
      display: "block", marginBottom: "12px", padding: "6px 16px", borderRadius: "6px",
      border: "1px solid var(--background-modifier-border)", background: "var(--background-secondary)", cursor: "pointer",
    });
    todayBtn.onclick = () => {
      const now = new Date();
      const j = toJalali(this.app, now.getFullYear(), now.getMonth() + 1, now.getDate());
      this.jy = Number(j.jy);
      this.jm = Number(j.jm);
      this.jd = Number(j.jd);
      this.updateHeader();
      this.renderGrid();
    };

    // هدر تقویم
    const header = contentEl.createEl("div", { cls: "re-datepicker-header" });
    header.setCssStyles({ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" });

    const prev = header.createEl("button", { text: "‹" });
    prev.setCssStyles({ padding: "4px 12px", cursor: "pointer" });
    prev.onclick = () => {
      this.jm--;
      if (this.jm < 1) { this.jm = 12; this.jy--; }
      this.updateHeader();
      this.renderGrid();
    };

    this.headerEl = header.createEl("h3");

    const next = header.createEl("button", { text: "›" });
    next.setCssStyles({ padding: "4px 12px", cursor: "pointer" });
    next.onclick = () => {
      this.jm++;
      if (this.jm > 12) { this.jm = 1; this.jy++; }
      this.updateHeader();
      this.renderGrid();
    };

    // شبکه
    const grid = contentEl.createEl("div", { cls: "re-datepicker-grid" });
    grid.setCssStyles({ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" });
    this.gridEl = grid;

    const weekDays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
    weekDays.forEach(d => {
      const cell = grid.createEl("div", { text: d });
      cell.setCssStyles({ textAlign: "center", fontWeight: "bold", padding: "8px", color: "var(--text-muted)" });
    });

    this.updateHeader();
    this.renderGrid();

    // دکمه‌های پایین
    const footer = contentEl.createEl("div");
    footer.setCssStyles({ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" });

    const cancel = footer.createEl("button", { text: "انصراف" });
    cancel.onclick = () => this.close();

    const ok = footer.createEl("button", { text: "تأیید", cls: "mod-cta" });
    ok.onclick = () => {
      const g = toGregorian(this.app, this.jy, this.jm, this.jd);
      const iso = `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
      this.onPick(iso);
      this.close();
    };
  }

  private updateHeader() {
    if (this.headerEl) {
      let monthName = "?";
      if (this.jm && this.jm >= 1 && this.jm <= 12) {
        monthName = jalaliMonthName(this.app, this.jm);
      }
      this.headerEl.textContent = `${monthName} ${this.jy || "?"}`;
    }
  }

  private renderGrid() {
    const grid = this.gridEl;
    if (!grid) return;

    const children = Array.from(grid.children);
    for (let i = 7; i < children.length; i++) children[i].remove();

    const daysInMonth = this.jm <= 6 ? 31 : (this.jm <= 11 ? 30 : 29);
    const firstG = toGregorian(this.app, this.jy, this.jm, 1);
    const firstDay = new Date(firstG.gy, firstG.gm - 1, firstG.gd);
    const startOffset = (firstDay.getDay() + 1) % 7; // شنبه=0

    for (let i = 0; i < startOffset; i++) grid.createEl("div");

    for (let d = 1; d <= daysInMonth; d++) {
      const isSelected = d === this.jd;
      const cell = grid.createEl("div", { text: String(d) });
      cell.setCssStyles({
        padding: "8px", borderRadius: "8px", textAlign: "center", cursor: "pointer",
        background: isSelected ? "var(--interactive-accent)" : "var(--background-secondary)",
        color: isSelected ? "white" : "var(--text-normal)",
        border: "1px solid var(--background-modifier-border)",
        fontWeight: isSelected ? "bold" : "normal",
      });
      cell.onclick = () => {
        this.jd = d;
        this.renderGrid();
      };
    }
  }

  onClose() { this.contentEl.empty(); }
}
