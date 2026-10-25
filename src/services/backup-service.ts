import { Notice } from "obsidian";
import RecoveryEnginePlugin from "../main";

export async function importBackupFromFile(
  plugin: RecoveryEnginePlugin,
  file: File
): Promise<void> {
  console.log("[Backup] فایل انتخاب شد:", file.name, file.size);
  try {
    const text = await file.text();
    console.log("[Backup] طول متن:", text.length);
    
    const parsed = JSON.parse(text);
    console.log("[Backup] ساختار JSON:", Object.keys(parsed));
    
    if (!parsed || !Array.isArray(parsed.items)) {
      console.error("[Backup] فایل معتبر نیست:", parsed);
      new Notice("فایل پشتیبان معتبر نیست (آرایه items پیدا نشد).");
      return;
    }
    console.log("[Backup] تعداد آیتم‌ها:", parsed.items.length);

    const current = await plugin.exportData();
    console.log("[Backup] تعداد آیتم‌های فعلی:", (current as any).items.length);

    const confirmed = confirm(
      `بازیابی ${parsed.items.length} مطلب جای‌گزین اطلاعات فعلی (${(current as any).items.length} مطلب) شود؟`
    );
    console.log("[Backup] تایید کاربر:", confirmed);
    
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

    await plugin.replaceAllData({
      settings: parsed.settings,
      items: parsed.items,
    });
    console.log("[Backup] replaceAllData اجرا شد.");

    new Notice("پشتیبان بازیابی شد.");
  } catch (e) {
    console.error("[Backup] خطا:", e);
    new Notice("خطا در خواندن فایل پشتیبان. کنسول را ببین.");
  }
}
