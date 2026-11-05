import { Notice } from "obsidian";
import RecoveryEnginePlugin from "../main";

export async function importBackupFromFile(
  plugin: RecoveryEnginePlugin,
  file?: File
): Promise<void> {
  const handleFile = async (f: File) => {
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.items)) {
        new Notice("فایل پشتیبان معتبر نیست.");
        return;
      }
      // نگه‌داری نسخهٔ فعلی
      const current = await plugin.exportData();
      const confirmed = confirm(
        `بازیابی ${parsed.items.length} مطلب جای‌گزین اطلاعات فعلی (${current.items.length} مطلب) شود؟ نسخهٔ فعلی در فایل پشتیبان خودکار ذخیره می‌شود.`
      );
      if (!confirmed) return;

      // دانلود نسخهٔ فعلی به‌عنوان پشتیبان خودکار
      const blob = new Blob([JSON.stringify(current, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = createEl("a");
      a.href = url;
      a.download = `recovery-engine-pre-restore-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      await plugin.replaceAllData({
        settings: parsed.settings,
        items: parsed.items,
      });
      new Notice("پشتیبان با موفقیت بازیابی شد.");
      plugin.refreshDashboards();
    } catch (e) {
      console.error(e);
      new Notice("خطا در خواندن فایل پشتیبان.");
    }
  };

  if (file) {
    await handleFile(file);
    return;
  }

  // ایجاد المان فایل با الصاق به صفحه تا در Obsidian / Electron بدون مشکل باز شود
  const input = createEl("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.setCssStyles({ display: "none" });
  document.body.appendChild(input);
  input.onchange = async () => {
    const f = input.files?.[0];
    if (f) {
      await handleFile(f);
    }
    input.remove();
  };
  input.click();
}
