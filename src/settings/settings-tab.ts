import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { Subject } from "../models/review-item";
import { importBackupFromFile } from "../services/backup-service";
import { hasPersianCalendar } from "../core/persian-bridge";

export class RecoverySettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: RecoveryEnginePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.setAttr("dir", "rtl");
    containerEl.createEl("h1", { text: "تنظیمات موتور بازیابی" });

    const s = this.plugin.settings;

    // ========== عمومی ==========
    containerEl.createEl("h2", { text: "عمومی" });
    new Setting(containerEl).setName("عنوان داشبورد").addText((t) =>
      t.setValue(s.dashboardTitle).onChange(async (v) => { s.dashboardTitle = v; await this.plugin.saveSettings(); this.plugin.refreshDashboards(); })
    );
    new Setting(containerEl).setName("نمایش آمار").addToggle((t) =>
      t.setValue(s.showStats).onChange(async (v) => { s.showStats = v; await this.plugin.saveSettings(); this.plugin.refreshDashboards(); })
    );
    new Setting(containerEl).setName("نمایش مرورهای انجام‌شده").addToggle((t) =>
      t.setValue(s.showCompleted).onChange(async (v) => { s.showCompleted = v; await this.plugin.saveSettings(); this.plugin.refreshDashboards(); })
    );

    // ========== نمایش تاریخ ==========
    containerEl.createEl("h2", { text: "نمایش تاریخ" });
    new Setting(containerEl).setName("فرمت تاریخ").addDropdown((d) => {
      d.addOption("gregorian", "میلادی"); d.addOption("jalali", "شمسی");
      d.setValue(s.dateFormat).onChange(async (v) => { s.dateFormat = v as any; await this.plugin.saveSettings(); this.plugin.refreshDashboards(); });
    });

    // ========== درس‌ها ==========
    containerEl.createEl("h2", { text: "درس‌ها" });
    const subjectsWrapper = containerEl.createEl("div", { cls: "re-subjects-section" });
    
    const renderSubjects = () => {
      subjectsWrapper.empty();
      s.subjects.forEach((subj, idx) => this.renderSubject(subjectsWrapper, subj, idx));
    };

    renderSubjects();

    new Setting(containerEl).addButton((b) =>
      b.setButtonText("افزودن درس جدید").setCta().onClick(async () => {
        s.subjects.push({ id: `subj-${Date.now()}`, name: "درس جدید", archived: false, checklist: [] });
        await this.plugin.saveSettings();
        renderSubjects();
      })
    );

    // ========== چرخه‌های مرور ==========
    containerEl.createEl("h2", { text: "چرخه‌های مرور" });
    containerEl.createEl("p", { text: "هر چرخه در یک باکس جداگانه است. با دکمه‌های داخل هر باکس، تعداد مرورها را تنظیم کنید.", cls: "setting-item-description" });

    const cyclesWrapper = containerEl.createEl("div", { cls: "re-cycles-wrapper" });
    this.renderCycleBox(cyclesWrapper, "initial", "مرورهای اولیه");
    this.renderCycleBox(cyclesWrapper, "weekend", "مرورهای هفتگی");
    this.renderCycleBox(cyclesWrapper, "monthly", "مرورهای ماهانه");
    this.renderCycleBox(cyclesWrapper, "longterm", "مرورهای بلندمدت");

    // ========== اعلان‌ها ==========
    containerEl.createEl("h2", { text: "اعلان‌ها" });
    new Setting(containerEl).setName("اعلان هنگام باز شدن").addToggle((t) =>
      t.setValue(s.notifyOnStartup).onChange(async (v) => { s.notifyOnStartup = v; await this.plugin.saveSettings(); })
    );
    new Setting(containerEl).setName("اعلان مرورهای عقب‌افتاده").addToggle((t) =>
      t.setValue(s.notifyOverdue).onChange(async (v) => { s.notifyOverdue = v; await this.plugin.saveSettings(); })
    );

    // ========== داده‌ها ==========
    containerEl.createEl("h2", { text: "داده‌ها" });
    new Setting(containerEl).setName("خروجی گرفتن").addButton((b) =>
      b.setButtonText("دانلود پشتیبان").onClick(async () => {
        const data = await this.plugin.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `recovery-engine-backup-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
        new Notice("پشتیبان دانلود شد.");
      })
    );
    const restoreSetting = new Setting(containerEl)
      .setName("بازیابی از فایل")
      .setDesc("فایل پشتیبان JSON را برای جایگزینی و بازگردانی اطلاعات انتخاب کنید.");

    const fileBtn = restoreSetting.controlEl.createDiv({ cls: "re-file-btn mod-cta" });
    fileBtn.setCssStyles({
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "6px 14px",
      borderRadius: "8px",
      background: "var(--interactive-accent)",
      color: "var(--text-on-accent)",
      fontSize: "12px",
      fontWeight: "600",
      cursor: "pointer",
      overflow: "hidden"
    });
    fileBtn.createSpan({ text: "انتخاب فایل" });

    const fileInput = fileBtn.createEl("input", { type: "file" });
    fileInput.accept = ".json,application/json";
    fileInput.setCssStyles({
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      opacity: "0",
      cursor: "pointer"
    });

    fileInput.onchange = async () => {
      const file = fileInput.files?.[0];
      if (file) {
        await importBackupFromFile(this.plugin, file);
      }
      fileInput.value = "";
    };
    new Setting(containerEl).setName("حذف همه مطالب").addButton((b) =>
      b.setButtonText("حذف همه").setWarning().onClick(async () => {
        if (confirm("همه مطالب حذف شوند؟")) { await this.plugin.deleteAllItems(); new Notice("همه مطالب حذف شدند."); }
      })
    );
  }

  // ========== باکس هر چرخه ==========
  private renderCycleBox(wrapper: HTMLElement, kind: string, title: string) {
    const s = this.plugin.settings;
    const list = (s.schedule as any)[kind];

    // ساخت باکس
    const box = wrapper.createEl("div", { cls: "re-cycle-box" });
    box.setCssStyles({
      padding: "16px",
      background: "var(--background-secondary)",
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "12px",
      marginBottom: "12px",
    });

    // هدر باکس: عنوان + سوییچ
    const header = box.createEl("div");
    header.setCssStyles({ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--background-modifier-border)" });
    header.createEl("h3", { text: title });
    header.querySelector("h3")!.setCssStyles({ margin: "0", fontSize: "16px" });

    const toggleLabel = header.createEl("label");
    toggleLabel.setCssStyles({ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" });
    toggleLabel.createEl("span", { text: list.enabled ? "فعال" : "غیرفعال" });
    const toggle = toggleLabel.createEl("input");
    toggle.type = "checkbox";
    toggle.checked = list.enabled;
    toggle.onchange = async () => {
      list.enabled = toggle.checked;
      await this.plugin.saveSettings();
      // رندر مجدد فقط همین باکس (بدون پرش)
      wrapper.empty();
      this.renderCycleBox(wrapper, "initial", "مرورهای اولیه");
      this.renderCycleBox(wrapper, "weekend", "مرورهای هفتگی");
      this.renderCycleBox(wrapper, "monthly", "مرورهای ماهانه");
      this.renderCycleBox(wrapper, "longterm", "مرورهای بلندمدت");
    };

    if (!list.enabled) return;

    // فیلد روز تجمیع (فقط برای ماهانه)
    if (kind === "monthly") {
      const row = box.createEl("div");
      row.setCssStyles({ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", padding: "8px", background: "var(--background-primary)", borderRadius: "8px" });
      row.createEl("span", { text: "روز تجمیع در ماه:", style: "font-size: 13px;" });
      const dayInput = row.createEl("input");
      dayInput.type = "number";
      dayInput.min = "1";
      dayInput.max = "31";
      dayInput.value = String(list.aggregationDay || 25);
      dayInput.setCssStyles({ width: "60px", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--background-modifier-border)" });
      dayInput.onchange = async () => {
        const n = parseInt(dayInput.value, 10);
        if (!isNaN(n) && n >= 1 && n <= 31) {
          list.aggregationDay = n;
          await this.plugin.saveSettings();
        }
      };
    }

    // لیست مرورها (فشرده)
    const listEl = box.createEl("div");
    listEl.setCssStyles({ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" });

    for (let i = 0; i < list.count; i++) {
      const row = listEl.createEl("div");
      row.setCssStyles({
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        background: "var(--background-primary)",
        borderRadius: "8px",
        border: "1px solid var(--background-modifier-border)",
      });

      row.createEl("span", { text: `مرور ${i + 1}`, style: "font-size: 13px; min-width: 60px;" });

      const select = row.createEl("select");
      select.setCssStyles({ flex: "1", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--background-modifier-border)" });

      if (kind === "initial") {
        for (let dOff = 0; dOff <= 14; dOff++) {
          const opt = select.createEl("option", { value: String(dOff), text: dOff === 0 ? "همان روز" : `${dOff} روز بعد` });
        }
        select.value = String(list.offsets[i] ?? i);
        select.onchange = async () => {
          list.offsets[i] = parseInt(select.value, 10);
          await this.plugin.saveSettings();
        };
      } else if (kind === "monthly") {
        select.createEl("option", { value: "0", text: "همان ماه" });
        for (let m = 1; m <= 24; m++) {
          select.createEl("option", { value: String(m), text: `${m} ماه بعد` });
        }
        select.value = String(list.offsetsMonths[i] ?? i);
        select.onchange = async () => {
          list.offsetsMonths[i] = parseInt(select.value, 10);
          await this.plugin.saveSettings();
        };
      } else if (kind === "longterm") {
        for (let m = 1; m <= 24; m++) {
          select.createEl("option", { value: String(m), text: `${m} ماه بعد` });
        }
        select.value = String(list.offsetsMonths[i] ?? (i + 1) * 6);
        select.onchange = async () => {
          list.offsetsMonths[i] = parseInt(select.value, 10);
          await this.plugin.saveSettings();
        };
      } else if (kind === "weekend") {
        select.remove();
        const dayNames = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
        const daySelect = row.createEl("select");
        daySelect.setCssStyles({ flex: "1", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--background-modifier-border)" });
        dayNames.forEach((name, idx) => daySelect.createEl("option", { value: String(idx), text: name }));
        daySelect.value = String(list.weekdays[i] ?? (i + 5) % 7);
        daySelect.onchange = async () => {
          list.weekdays[i] = parseInt(daySelect.value, 10);
          await this.plugin.saveSettings();
        };
      }

      // دکمه حذف
      const delBtn = row.createEl("button", { text: "×" });
      delBtn.setCssStyles({ width: "28px", height: "28px", borderRadius: "6px", background: "var(--background-modifier-error)", color: "white", border: "none", cursor: "pointer", fontSize: "16px", padding: "0" });
      delBtn.onclick = async () => {
        if (kind === "initial") list.offsets.splice(i, 1);
        else if (kind === "monthly" || kind === "longterm") list.offsetsMonths.splice(i, 1);
        else if (kind === "weekend") list.weekdays.splice(i, 1);
        list.count--;
        await this.plugin.saveSettings();
        wrapper.empty();
        this.renderCycleBox(wrapper, "initial", "مرورهای اولیه");
        this.renderCycleBox(wrapper, "weekend", "مرورهای هفتگی");
        this.renderCycleBox(wrapper, "monthly", "مرورهای ماهانه");
        this.renderCycleBox(wrapper, "longterm", "مرورهای بلندمدت");
      };
    }

    // دکمه افزودن
    const addBtn = box.createEl("button", { text: "+ افزودن مرور" });
    addBtn.setCssStyles({
      padding: "6px 14px",
      borderRadius: "8px",
      background: "var(--interactive-accent)",
      color: "white",
      border: "none",
      cursor: "pointer",
      fontSize: "12px",
      fontWeight: "600",
    });
    addBtn.onclick = async () => {
      if (kind === "initial") {
        list.offsets.push(list.offsets.length > 0 ? list.offsets[list.offsets.length - 1] + 1 : 0);
        list.count = list.offsets.length;
      } else if (kind === "weekend") {
        list.weekdays.push(5);
        list.count = list.weekdays.length;
      } else if (kind === "monthly") {
        list.offsetsMonths.push(list.offsetsMonths.length);
        list.count = list.offsetsMonths.length;
      } else if (kind === "longterm") {
        list.offsetsMonths.push((list.offsetsMonths.length + 1) * 6);
        list.count = list.offsetsMonths.length;
      }
      await this.plugin.saveSettings();
      wrapper.empty();
      this.renderCycleBox(wrapper, "initial", "مرورهای اولیه");
      this.renderCycleBox(wrapper, "weekend", "مرورهای هفتگی");
      this.renderCycleBox(wrapper, "monthly", "مرورهای ماهانه");
      this.renderCycleBox(wrapper, "longterm", "مرورهای بلندمدت");
    };
  }

  private renderSubject(container: HTMLElement, subj: Subject, idx: number) {
    const box = container.createEl("div", { cls: "re-cycle-box" });
    box.setCssStyles({
      padding: "16px",
      background: "var(--background-secondary)",
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "12px",
      marginBottom: "12px",
    });

    // هدر: نام درس و دکمه حذف
    const header = box.createEl("div");
    header.setCssStyles({ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", paddingBottom: "8px", borderBottom: "1px solid var(--background-modifier-border)" });

    const nameInput = header.createEl("input");
    nameInput.type = "text";
    nameInput.value = subj.name;
    nameInput.setCssStyles({ flex: "1", padding: "4px 8px", fontSize: "16px", fontWeight: "bold", background: "transparent", border: "none", color: "var(--text-normal)", outline: "none" });
    nameInput.onchange = async () => {
      subj.name = nameInput.value;
      await this.plugin.saveSettings();
    };

    const delSubjectBtn = header.createEl("button", { text: "×" });
    delSubjectBtn.setCssStyles({ width: "28px", height: "28px", borderRadius: "6px", background: "var(--background-modifier-error)", color: "white", border: "none", cursor: "pointer", fontSize: "16px", padding: "0" });
    delSubjectBtn.onclick = async () => {
      if (!confirm(`درس «${subj.name}» حذف شود؟`)) return;
      this.plugin.settings.subjects.splice(idx, 1);
      await this.plugin.saveSettings();
      this.display();
    };

    // سوییچ بایگانی
    const archiveRow = box.createEl("div");
    archiveRow.setCssStyles({ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" });
    const archiveCb = archiveRow.createEl("input", { type: "checkbox" });
    archiveCb.checked = subj.archived;
    archiveCb.onchange = async () => {
      subj.archived = archiveCb.checked;
      await this.plugin.saveSettings();
    };
    archiveRow.createEl("span", { text: "بایگانی شده (در فرم ثبت مطلب نمایش داده نشود)", style: "font-size: 12px; color: var(--text-muted);" });

    // بخش چک‌لیست
    box.createEl("div", { text: "چک‌لیست مرور:", style: "font-size: 13px; font-weight: 600; margin-bottom: 8px; margin-top: 8px;" });
    
    const checklistWrapper = box.createEl("div");
    checklistWrapper.setCssStyles({ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" });

    const renderChecklist = () => {
      checklistWrapper.empty();
      subj.checklist.forEach((item, itemIdx) => {
        const row = checklistWrapper.createEl("div");
        row.setCssStyles({
          display: "flex", alignItems: "center", gap: "8px",
          padding: "6px 10px", background: "var(--background-primary)",
          borderRadius: "8px", border: "1px solid var(--background-modifier-border)"
        });

        const input = row.createEl("input", { type: "text", value: item });
        input.setCssStyles({ flex: "1", padding: "4px 8px", background: "transparent", border: "none", color: "var(--text-normal)", outline: "none", fontSize: "13px" });
        input.onchange = async () => {
          subj.checklist[itemIdx] = input.value;
          await this.plugin.saveSettings();
        };

        const delBtn = row.createEl("button", { text: "×" });
        delBtn.setCssStyles({ width: "24px", height: "24px", borderRadius: "4px", background: "var(--background-modifier-error)", color: "white", border: "none", cursor: "pointer", fontSize: "14px", padding: "0" });
        delBtn.onclick = async () => {
          subj.checklist.splice(itemIdx, 1);
          await this.plugin.saveSettings();
          renderChecklist();
        };
      });
    };

    renderChecklist();

    // دکمه افزودن آیتم
    const addBtn = box.createEl("button", { text: "+ افزودن آیتم چک‌لیست" });
    addBtn.setCssStyles({
      padding: "6px 14px", borderRadius: "8px", background: "var(--interactive-accent)", color: "white",
      border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600"
    });
    addBtn.onclick = async () => {
      subj.checklist.push("");
      await this.plugin.saveSettings();
      renderChecklist();
    };
  }
}
