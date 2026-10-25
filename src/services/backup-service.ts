import { App, Notice } from "obsidian";
import RecoveryEnginePlugin from "../main";

export async function importBackupFromFile(plugin: RecoveryEnginePlugin): Promise<void> {
  // ساخت input
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";

  // استایل: input را کاملاً روی دکمه‌ای که کاربر کلیک می‌کند قرار می‌دهیم
  // تا کلیک کاربر مستقیماً روی خود input بیفتد (حل مشکل user activation)
  input.style.position = "fixed";
  input.style.top = "0";
  input.style.left = "0";
  input.style.width = "100vw";
  input.style.height = "100vh";
  input.style.opacity = "0";
  input.style.zIndex = "9999";
  input.style.cursor = "pointer";

  document.body.appendChild(input);

  // به محض اینکه کاربر روی input کلیک کند و فایل انتخاب کند:
  input.onchange = async () => {
    const file = input.files?.[0];
    
    // پاک‌سازی فوری input از صفحه
    document.body.removeChild(input);

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed || !Array.isArray(parsed.items)) {
        new Notice("فایل پشتیبان معتبر نیست.");
        return;
      }

      const current = await plugin.exportData();
      const confirmed = confirm(
        `بازیابی ${parsed.items.length} مطلب جای‌گزین اطلاعات فعلی (${(current as any).items.length} مطلب) شود؟`
      );

      if (!confirmed) return;

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
    }
  };

  // اگر کاربر روی جای دیگری کلیک کرد و فایلی انتخاب نکرد، input را پاک کن
  input.onblur = () => {
    setTimeout(() => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    }, 300);
  };
}
