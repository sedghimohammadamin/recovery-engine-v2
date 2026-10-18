import { Platform, Notice } from "obsidian";

export interface MacAction {
  id: string;
  label: string;
}

/**
 * نوتیفیکیشن macOS با دکمه‌های واقعی از طریق alerter.
 * پیش‌نیاز: brew install vjeantet/tap/alerter
 * alerter را از طریق window.require صدا می‌زنیم چون
 * child_process در باندل افزونه در دسترس نیست.
 */
export function sendMacNotificationWithActions(
  title: string,
  body: string,
  actions: MacAction[],
  onAction: (actionId: string) => void
): void {
  console.log("[RecoveryEngine] sendMacNotificationWithActions called, isMacOS =", Platform.isMacOS);
  if (!Platform.isMacOS) return;

  try {
    const req = (window as unknown).require;
    if (typeof req !== "function") {
      console.error("[RecoveryEngine] window.require در دسترس نیست");
      new Notice("خطا: window.require در دسترس نیست. alerter اجرا نشد.");
      return;
    }
    const { exec } = req("child_process");
    const actionList = actions.map((a) => a.label).join(",");
    // مسیر کامل alerter (اگر جای دیگری نصب کردی، عوض کن)
    const binPath = "/opt/homebrew/bin/alerter";
    const cmd = `"${binPath}" --title "${title}" --message "${body}" --actions "${actionList}"`;
    console.log("[RecoveryEngine] exec:", cmd);

    exec(cmd, (err: unknown, stdout: string, stderr: string) => {
      console.log("[RecoveryEngine] alerter stdout:", stdout, "stderr:", stderr, "err:", err);
      if (err) {
        console.error("[RecoveryEngine] alerter error:", err);
        new Notice("خطا در اجرای alerter. کنسول را ببین.");
        return;
      }
      const choice = String(stdout || "").trim();
      const matched = actions.find((a) => a.label === choice);
      if (matched) {
        onAction(matched.id);
      } else {
        console.warn("[RecoveryEngine] انتخاب ناشناخته از alerter:", choice);
      }
    });
  } catch (e) {
    console.error("[RecoveryEngine] خطای exec:", e);
    new Notice("خطا در اجرای alerter. کنسول را ببین.");
  }
}
