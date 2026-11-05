import { Platform, Notice } from "obsidian";

export interface MacAction {
  id: string;
  label: string;
}

/**
 * نوتیفیکیشن macOS با دکمه‌های واقعی از طریق alerter.
 * پیش‌نیاز: brew install vjeantet/tap/alerter
 */
export function sendMacNotificationWithActions(
  title: string,
  body: string,
  actions: MacAction[],
  onAction: (id: string) => void
): void {
  // فقط روی دسکتاپ اجرا شود
  if (!Platform.isDesktopApp) {
    // در موبایل، فقط از Notice استفاده میکنیم
    new Notice(`${title}: ${body}`);
    return;
  }

  if (!Platform.isMacOS) return; // فعلاً فقط مک

  try {
    const req = (window as unknown).require;
    if (typeof req !== "function") {
      console.error("[RecoveryEngine] window.require در دسترس نیست");
      new Notice("خطا: alerter اجرا نشد.");
      return;
    }
    const { exec } = req("child_process");
    const actionList = actions.map((a) => a.label).join(",");
    const binPath = "/opt/homebrew/bin/alerter";
    const cmd = `"${binPath}" --title "${title}" --message "${body}" --actions "${actionList}"`;

    exec(cmd, (err: unknown, stdout: string, stderr: string) => {
      if (err) {
        console.error("[RecoveryEngine] alerter error:", err);
        return;
      }
      const choice = String(stdout || "").trim();
      const matched = actions.find((a) => a.label === choice);
      if (matched) {
        onAction(matched.id);
      }
    });
  } catch (e) {
    console.error("[RecoveryEngine] خطای exec:", e);
    new Notice("خطا در اجرای alerter.");
  }
}
