import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import RecoveryEnginePlugin from "../main";
import { Subject } from "../models/review-item";
import { importBackupFromFile } from "../services/backup-service";
import { hasPersianCalendar } from "../core/persian-bridge";
import { sendMacNotificationWithActions } from "../services/notify-mac";

export class RecoverySettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: RecoveryEnginePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.setAttr("dir", "rtl");
    ;

    const s = this.plugin.settings;

    // ---------- عمومی ----------
    new Setting(containerEl).setName("عمومی").setHeading();
    new Setting(containerEl).setName("نام نمایشی").addText((t) =>
      t.setValue(s.displayName).onChange(async (v) => { s.displayName = v; await this.plugin.saveSettings(); })
    );
    new Setting(containerEl).setName("عنوان داشبورد").addText((t) =>
      t.setValue(s.dashboardTitle).onChange(async (v) => { s.dashboardTitle = v; await this.plugin.saveSettings(); this.plugin.refreshDashboards(); })
    );
    new Setting(containerEl).setName("نمایش آمار").addToggle((t) =>
      t.setValue(s.showStats).onChange(async (v) => { s.showStats = v; await this.plugin.saveSettings(); this.plugin.refreshDashboards(); })
    );
    new Setting(containerEl).setName("نمایش مرورهای انجام‌شده").addToggle((t) =>
      t.setValue(s.showCompleted).onChange(async (v) => { s.showCompleted = v; await this.plugin.saveSettings(); this.plugin.refreshDashboards(); })
    );
    new Setting(containerEl).setName("بازهٔ آینده (روز)").addText((t) => {
      t.inputEl.type = "number";
      t.setValue(String(s.upcomingWindowDays)).onChange(async (v) => {
        const n = parseInt(v, 10);
        if (!isNaN(n) && n >= 0) { s.upcomingWindowDays = n; await this.plugin.saveSettings(); this.plugin.refreshDashboards(); }
      });
    });
    new Setting(containerEl).setName("تعداد نمایش در هر بخش").addText((t) => {
      t.inputEl.type = "number";
      t.setValue(String(s.dashboardListLimit)).onChange(async (v) => {
        const n = parseInt(v, 10);
        if (!isNaN(n) && n > 0) { s.dashboardListLimit = n; await this.plugin.saveSettings(); this.plugin.refreshDashboards(); }
      });
    });

    // ---------- نمایش تاریخ ----------
    new Setting(containerEl).setName("نمایش تاریخ").setHeading();
    const pcAvail = hasPersianCalendar(this.app);
    new Setting(containerEl)
      .setName("فرمت نمایش تاریخ")
      .setDesc(
        pcAvail
          ? "افزونهٔ Persian Calendar شناسایی شد. تاریخ‌ها قابل نمایش شمسی هستند."
          : "⚠️ افزونهٔ Persian Calendar نصب نیست. تا نصب نشود، تاریخ‌ها میلادی نمایش داده می‌شوند."
      )
      .addDropdown((d) => {
        d.addOption("gregorian", "میلادی");
        d.addOption("jalali", "شمسی (نیازمند Persian Calendar)");
        d.setValue(s.dateFormat).onChange(async (v) => {
          s.dateFormat = v as unknown;
          await this.plugin.saveSettings();
          this.plugin.refreshDashboards();
        });
      });

    // ---------- اعلان‌ها ----------
    new Setting(containerEl).setName("شناسهٔ والت").setHeading();
    new Setting(containerEl)
      .setName("Vault ID")
      .setDesc("برای باز کردن والت از روی نوتیفیکیشن. از Vault switcher → راست‌کلیک روی والت → Copy vault ID")
      .addText((t) =>
        t.setValue(s.vaultId ?? "").onChange(async (v) => {
          s.vaultId = v.trim();
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("اعلان‌ها").setHeading();

    new Setting(containerEl).setName("اعلان هنگام باز شدن Obsidian").addToggle((t) =>
      t.setValue(s.notifyOnStartup).onChange(async (v) => { s.notifyOnStartup = v; await this.plugin.saveSettings(); })
    );
    new Setting(containerEl).setName("اعلان مرورهای عقب‌افتاده").addToggle((t) =>
      t.setValue(s.notifyOverdue).onChange(async (v) => { s.notifyOverdue = v; await this.plugin.saveSettings(); })
    );
    new Setting(containerEl).setName("روش اعلان").addDropdown((d) => {
      d.addOption("obsidian", "فقط داخل Obsidian");
      d.addOption("macos", "فقط نوتیفیکیشن macOS");
      d.addOption("both", "هر دو");
      d.setValue((s as unknown).notifyMode ?? "both").onChange(async (v) => {
        (s as unknown).notifyMode = v;
        await this.plugin.saveSettings();
      });
    });

    // دکمهٔ تست
    new Setting(containerEl)
      .setName("تست اعلان")
      .setDesc("یک اعلان نمونه با دکمه‌های باز کردن والت و تعویق نمایش می‌دهد.")
      .addButton((b) =>
        b.setButtonText("ارسال تست").onClick(async () => {
          const { notifyOverdueWithActions } = await import("../services/notify-service");
          notifyOverdueWithActions(
            this.app,
            3,
            (s as unknown).notifyMode ?? "both",
            async () => { new Notice("(تست) باز کردن والت"); },
            async () => { new Notice("(تست) تعویق"); }
          );
        })
      );

    // دکمهٔ تست مستقیم alerter
    new Setting(containerEl)
      .setName("تست alerter (macOS)")
      .setDesc("مستقیم alerter را صدا می‌زند و نتیجه را در کنسول نشان می‌دهد.")
      .addButton((b) =>
        b.setButtonText("تست alerter").onClick(() => {
          console.log("[RecoveryEngine] دکمهٔ تست alerter زده شد");
          sendMacNotificationWithActions(
            "Recovery Engine",
            "این یک تست مستقیم از تنظیمات است",
            [
              { id: "open", label: "باز کردن والت" },
              { id: "snooze", label: "تعویق" },
            ],
            (choice) => {
              console.log("[RecoveryEngine] انتخاب کاربر:", choice);
              new Notice("انتخاب شد: " + choice);
            }
          );
        })
      );

    new Setting(containerEl).setName("تأیید پیش از حذف").addToggle((t) =>
      t.setValue(s.requireConfirmOnDelete).onChange(async (v) => { s.requireConfirmOnDelete = v; await this.plugin.saveSettings(); })
    );

    // ---------- درس‌ها ----------
    new Setting(containerEl).setName("درس‌ها").setHeading();
    s.subjects.forEach((subj, idx) => this.renderSubject(containerEl, subj, idx));
    new Setting(containerEl).addButton((b) =>
      b.setButtonText("افزودن درس").onClick(async () => {
        s.subjects.push({
          id: `subj-${Date.now()}`,
          name: "درس جدید",
          archived: false,
          checklist: [],
        });
        await this.plugin.saveSettings();
        this.display();
      })
    );

    // ---------- زمان‌بندی ----------
    new Setting(containerEl).setName("چرخهٔ اولیه").setHeading();
    new Setting(containerEl).setName("فعال").addToggle((t) =>
      t.setValue(s.schedule.initial.enabled).onChange(async (v) => { s.schedule.initial.enabled = v; await this.plugin.saveSettings(); })
    );
    new Setting(containerEl).setName("تعداد مرور").addText((t) => {
      t.inputEl.type = "number";
      t.setValue(String(s.schedule.initial.count)).onChange(async (v) => {
        const n = parseInt(v, 10);
        if (!isNaN(n) && n >= 0) { s.schedule.initial.count = n; await this.plugin.saveSettings(); }
      });
    });
    new Setting(containerEl).setName("فاصله‌ها (روز، با کاما)").addText((t) =>
      t.setValue(s.schedule.initial.offsets.join(",")).onChange(async (v) => {
        s.schedule.initial.offsets = v.split(",").map((x) => parseInt(x.trim(), 10)).filter((x) => !isNaN(x));
        await this.plugin.saveSettings();
      })
    );
    new Setting(containerEl).setName("روز یادگیری = روز اول").addToggle((t) =>
      t.setValue(s.schedule.countLearningDayAsFirst).onChange(async (v) => { s.schedule.countLearningDayAsFirst = v; await this.plugin.saveSettings(); })
    );

    new Setting(containerEl).setName("آخر هفته").setHeading();
    new Setting(containerEl).setName("فعال").addToggle((t) =>
      t.setValue(s.schedule.weekend.enabled).onChange(async (v) => { s.schedule.weekend.enabled = v; await this.plugin.saveSettings(); })
    );
    new Setting(containerEl).setName("تعداد").addText((t) => {
      t.inputEl.type = "number";
      t.setValue(String(s.schedule.weekend.count)).onChange(async (v) => {
        const n = parseInt(v, 10);
        if (!isNaN(n) && n >= 0) { s.schedule.weekend.count = n; await this.plugin.saveSettings(); }
      });
    });
    new Setting(containerEl).setName("روزهای هفته (0=شنبه، 1=یکشنبه، …، 6=جمعه)").addText((t) =>
      t.setValue(s.schedule.weekend.weekdays.join(",")).onChange(async (v) => {
        s.schedule.weekend.weekdays = v.split(",").map((x) => parseInt(x.trim(), 10)).filter((x) => !isNaN(x) && x >= 0 && x <= 6);
        await this.plugin.saveSettings();
      })
    );

    new Setting(containerEl).setName("ماهانه").setHeading();
    new Setting(containerEl).setName("فعال").addToggle((t) =>
      t.setValue(s.schedule.monthly.enabled).onChange(async (v) => { s.schedule.monthly.enabled = v; await this.plugin.saveSettings(); })
    );
    new Setting(containerEl).setName("تعداد").addText((t) => {
      t.inputEl.type = "number";
      t.setValue(String(s.schedule.monthly.count)).onChange(async (v) => {
        const n = parseInt(v, 10);
        if (!isNaN(n) && n >= 0) { s.schedule.monthly.count = n; await this.plugin.saveSettings(); }
      });
    });
    new Setting(containerEl).setName("فاصله‌ها (ماه)").addText((t) =>
      t.setValue(s.schedule.monthly.offsetsMonths.join(",")).onChange(async (v) => {
        s.schedule.monthly.offsetsMonths = v.split(",").map((x) => parseInt(x.trim(), 10)).filter((x) => !isNaN(x));
        await this.plugin.saveSettings();
      })
    );
    new Setting(containerEl).setName("روز تجمیع (1..31)").addText((t) => {
      t.inputEl.type = "number";
      t.setValue(String(s.schedule.monthly.aggregationDay)).onChange(async (v) => {
        const n = parseInt(v, 10);
        if (!isNaN(n) && n >= 1 && n <= 31) { s.schedule.monthly.aggregationDay = n; await this.plugin.saveSettings(); }
      });
    });
    new Setting(containerEl).setName("قانون ماه کوتاه").addDropdown((d) => {
      d.addOption("last-day", "آخرین روز ماه");
      d.addOption("next-month-first", "اول ماه بعد");
      d.setValue(s.schedule.monthly.shortMonthRule).onChange(async (v) => {
        s.schedule.monthly.shortMonthRule = v as unknown; await this.plugin.saveSettings();
      });
    });

    new Setting(containerEl).setName("بلندمدت").setHeading();
    new Setting(containerEl).setName("فعال").addToggle((t) =>
      t.setValue(s.schedule.longterm.enabled).onChange(async (v) => { s.schedule.longterm.enabled = v; await this.plugin.saveSettings(); })
    );
    new Setting(containerEl).setName("تعداد").addText((t) => {
      t.inputEl.type = "number";
      t.setValue(String(s.schedule.longterm.count)).onChange(async (v) => {
        const n = parseInt(v, 10);
        if (!isNaN(n) && n >= 0) { s.schedule.longterm.count = n; await this.plugin.saveSettings(); }
      });
    });
    new Setting(containerEl).setName("فاصله‌ها (ماه)").addText((t) =>
      t.setValue(s.schedule.longterm.offsetsMonths.join(",")).onChange(async (v) => {
        s.schedule.longterm.offsetsMonths = v.split(",").map((x) => parseInt(x.trim(), 10)).filter((x) => !isNaN(x));
        await this.plugin.saveSettings();
      })
    );

    // ---------- پشتیبان ----------
    new Setting(containerEl).setName("پشتیبان‌گیری").setHeading();
    new Setting(containerEl).setName("خروجی JSON").addButton((b) =>
      b.setButtonText("دانلود").onClick(async () => {
        const data = await this.plugin.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = createEl("a");
        a.href = url;
        a.download = `recovery-engine-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        new Notice("پشتیبان ساخته شد.");
      })
    );
    new Setting(containerEl).setName("حذف همهٔ مطالب (با تأیید)").addButton((b) =>
      b.setButtonText("حذف همه").setWarning().onClick(async () => {
        const c1 = confirm("همهٔ مطالب برای همیشه حذف شوند؟");
        if (!c1) return;
        const c2 = confirm("مطمئنید؟ این عملیات قابل بازگشت نیست.");
        if (!c2) return;
        await this.plugin.deleteAllItems();
        new Notice("همهٔ مطالب حذف شدند.");
      })
    );

    new Setting(containerEl)
      .setName("بازنشانی کامل")
      .setDesc("همهٔ داده‌ها و تنظیمات به حالت اولیه برمی‌گردد (غیرقابل بازگشت).")
      .addButton((b) =>
        b.setButtonText("بازنشانی").setWarning().onClick(async () => {
          if (!confirm("همهٔ داده‌ها و تنظیمات حذف شوند؟")) return;
          if (!confirm("مطمئنید؟ این کار قابل بازگشت نیست.")) return;
          await this.plugin.resetAll();
          new Notice("همه چیز به حالت اولیه برگشت.");
        })
      );

    new Setting(containerEl).setName("بازیابی از فایل").addButton((b) =>
      b.setButtonText("انتخاب فایل").onClick(() => importBackupFromFile(this.plugin))
    );
  }

  private renderSubject(containerEl: HTMLElement, subj: Subject, idx: number) {
    const box = containerEl.createDiv({ cls: "re-subject-box" });
    new Setting(box).setName("نام درس").addText((t) =>
      t.setValue(subj.name).onChange(async (v) => { subj.name = v; await this.plugin.saveSettings(); })
    );
    new Setting(box).setName("بایگانی").addToggle((t) =>
      t.setValue(subj.archived).onChange(async (v) => { subj.archived = v; await this.plugin.saveSettings(); })
    );
    new Setting(box).setName("چک‌لیست (هر خط یک آیتم)").addTextArea((t) => {
      t.setValue(subj.checklist.join("\n"));
      t.inputEl.rows = 4;
      t.onChange(async (v) => {
        subj.checklist = v.split("\n").map((x) => x.trim()).filter(Boolean);
        await this.plugin.saveSettings();
      });
    });
    new Setting(box).addButton((b) =>
      b.setButtonText("حذف درس").setWarning().onClick(async () => {
        if (!confirm(`درس «${subj.name}» حذف شود؟ مطالبش حذف نمی‌شوند اما درس نامعلوم می‌شوند.`)) return;
        this.plugin.settings.subjects.splice(idx, 1);
        await this.plugin.saveSettings();
        this.display();
      })
    );
  }
}
