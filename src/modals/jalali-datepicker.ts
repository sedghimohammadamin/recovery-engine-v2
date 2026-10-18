import { App, Modal } from "obsidian";
import { getPersianCalendarApi } from "../core/persian-bridge";

export class JalaliDatePickerModal extends Modal {
  private jy = 1405; private jm = 1; private jd = 1;
  private gYear = 2026;

  constructor(app: App, private initialIso: string, private onPick: (iso: string) => void) {
    super(app);
    const api = getPersianCalendarApi(app);
    if (api) {
      const [gy, gm, gd] = initialIso.split("-").map(Number);
      const j = api.gregorianToJalali(gy, gm, gd);
      this.jy = j.jy; this.jm = j.jm; this.jd = j.jd;
      this.gYear = gy;
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.setAttr("dir", "rtl");
    contentEl.createEl("h3", { text: "انتخاب تاریخ شمسی" });

    const wrap = contentEl.createDiv();
    wrap.setCssStyles({ display: "flex" }); wrap.setCssStyles({ gap: "8px" }); wrap.setCssStyles({ margin: "12px 0" });

    const ySel = wrap.createEl("select");
    for (let y = this.gYear - 20; y <= this.gYear + 20; y++) {
      const api = getPersianCalendarApi(this.app);
      if (api) {
        const jy = api.gregorianToJalali(y, 1, 1).jy;
        ySel.createEl("option", { value: String(y), text: String(jy) });
      }
    }
    ySel.value = String(this.gYear);

    const mSel = wrap.createEl("select");
    const api = getPersianCalendarApi(this.app);
    for (let m = 1; m <= 12; m++) {
      const name = api ? api.jalaliMonthName(m) : String(m);
      mSel.createEl("option", { value: String(m), text: name });
    }
    mSel.value = String(this.jm);

    const dSel = wrap.createEl("select");
    const refreshDays = () => {
      dSel.empty();
      const max = (this.jm <= 6) ? 31 : (this.jm <= 11 ? 30 : 29);
      for (let d = 1; d <= max; d++) dSel.createEl("option", { value: String(d), text: String(d) });
      if (this.jd > max) this.jd = max;
      dSel.value = String(this.jd);
    };
    refreshDays();

    mSel.onchange = () => { this.jm = Number(mSel.value); refreshDays(); };
    dSel.onchange = () => { this.jd = Number(dSel.value); };

    const btns = contentEl.createDiv();
    btns.setCssStyles({ display: "flex" }); btns.setCssStyles({ gap: "8px" }); btns.setCssStyles({ justifyContent: "flex-end" });

    const cancel = btns.createEl("button", { text: "انصراف" });
    cancel.onclick = () => this.close();

    const ok = btns.createEl("button", { text: "تأیید" });
    ok.addClass("mod-cta");
    ok.onclick = () => {
      const api2 = getPersianCalendarApi(this.app);
      if (api2) {
        const g = api2.jalaliToGregorian(this.jy, this.jm, this.jd);
        const iso = `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
        this.onPick(iso);
      }
      this.close();
    };
  }

  onClose() { this.contentEl.empty(); }
}
