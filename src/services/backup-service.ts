import { App, Notice } from "obsidian";
import RecoveryEnginePlugin from "../main";

export async function importBackupFromFile(plugin: RecoveryEnginePlugin): Promise<void> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.style.display = "none";
  document.body.appendChild(input);

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) {
      document.body.removeChild(input);
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed || !Array.isArray(parsed.items)) {
        new Notice("فایل پشتیبان معتبر نیست.");
        document.body.removeChild(input);
        return;
      }

      const current = await plugin.exportData();
      const confirmed = confirm(
        `بازیابی ${parsed.items.length} مطلب جای‌گزین اطلاعات فعلی (${(current as any).items.length} مطلب) شود؟ نسخهٔ فعلی در فایل پشتیبان خودکار ذخیره می‌شود.`
      );

      if (!confirmed) {
        document.body.removeChild(input);
        return;
      }

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

      await plugin.replaceAllData({
        settings: parsed.settings,
        items: parsed.items,
      });

      new Notice("پشتیبان بازیابی شد.");
    } catch (e) {
      console.error(e);
      new Notice("خطا در خواندن فایل پشتیبان.");
    } finally {
      document.body.removeChild(input);
    }
  };

  input.click();
}
