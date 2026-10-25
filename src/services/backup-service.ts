import { App, Notice, TFile, Modal, Setting } from "obsidian";
import RecoveryEnginePlugin from "../main";

/**
 * مودال انتخاب فایل پشتیبان از داخل والت
 */
class BackupFilePickerModal extends Modal {
  constructor(
    app: App,
    private plugin: RecoveryEnginePlugin,
    private files: TFile[]
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.setAttr("dir", "rtl");
    contentEl.createEl("h2", { text: "انتخاب فایل پشتیبان" });

    if (this.files.length === 0) {
      contentEl.createEl("p", { text: "هیچ فایل JSON در والت پیدا نشد." });
      new Setting(contentEl).addButton((b) =>
        b.setButtonText("بستن").onClick(() => this.close())
      );
      return;
    }

    const list = contentEl.createEl("div");
    list.setCssStyles({ maxHeight: "400px", overflowY: "auto", marginTop: "12px" });

    for (const file of this.files) {
      const row = list.createEl("div");
      row.setCssStyles({
        padding: "10px 14px",
        margin: "6px 0",
        background: "var(--background-secondary)",
        borderRadius: "8px",
        cursor: "pointer",
        border: "1px solid var(--background-modifier-border)",
      });
      row.textContent = file.path;
      row.onmouseenter = () => {
        row.style.background = "var(--background-modifier-hover)";
      };
      row.onmouseleave = () => {
        row.style.background = "var(--background-secondary)";
      };
      row.onclick = async () => {
        this.close();
        await this.restoreFromFile(file);
      };
    }

    new Setting(contentEl).addButton((b) =>
      b.setButtonText("انصراف").onClick(() => this.close())
    );
  }

  private async restoreFromFile(file: TFile) {
    try {
      const text = await this.app.vault.read(file);
      const parsed = JSON.parse(text);

      if (!parsed || !Array.isArray(parsed.items)) {
        new Notice("فایل پشتیبان معتبر نیست.");
        return;
      }

      const current = await this.plugin.exportData();
      const confirmed = confirm(
        `بازیابی ${parsed.items.length} مطلب جای‌گزین اطلاعات فعلی (${(current as any).items.length} مطلب) شود؟`
      );
      if (!confirmed) return;

      // دانلود نسخهٔ فعلی
      const blob = new Blob([JSON.stringify(current, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recovery-engine-pre-restore-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      await this.plugin.replaceAllData({
        settings: parsed.settings,
        items: parsed.items,
      });

      new Notice("پشتیبان بازیابی شد.");
    } catch (e) {
      console.error(e);
      new Notice("خطا در خواندن فایل پشتیبان.");
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

/**
 * باز کردن مودال انتخاب فایل از داخل والت
 */
export async function importBackupFromFile(plugin: RecoveryEnginePlugin): Promise<void> {
  // پیدا کردن فایل‌های JSON در والت
  const files = plugin.app.vault.getFiles().filter((f) => f.extension === "json");

  if (files.length === 0) {
    new Notice("هیچ فایل JSON در والت پیدا نشد. ابتدا یک فایل پشتیبان به والت اضافه کنید.");
    return;
  }

  new BackupFilePickerModal(plugin.app, plugin, files).open();
}
