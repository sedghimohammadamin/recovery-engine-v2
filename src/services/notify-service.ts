import { App, Notice, Platform } from "obsidian";

export type NotifyMode = "obsidian" | "macos" | "both";

export interface NotifyAction {
  label: string;
  onClick: () => void | Promise<void>;
}

/**
 * اعلان ترکیبی:
 * - همیشه Notice داخلی Obsidian (سریع).
 * - اگر macOS و mode شامل macos: نوتیفیکیشن بومی Electron.
 *   توجه: دکمه روی نوتیفیکیشن بومی macOS برای Obsidian کار نمی‌کند
 *   (نیاز به app signed + NSUserNotificationAlertStyle=alert).
 *   بنابراین اکشن‌ها فقط در Notice داخلی قابل کلیک هستند.
 */
export function notify(
  app: App,
  title: string,
  body: string,
  mode: NotifyMode = "both",
  actions: NotifyAction[] = []
): void {
  if (mode !== "macos") {
    const notice = new Notice("", 10000);
    // بازنویسی محتوا با HTML برای دکمه‌ها
    const root = notice.noticeEl;
    root.empty();
    root.createDiv({ text: title, cls: "re-notice-title" });
    root.createDiv({ text: body, cls: "re-notice-body" });

    if (actions.length) {
      const row = root.createDiv({ cls: "re-notice-actions" });
      for (const a of actions) {
        const btn = row.createEl("button", { text: a.label });
        btn.setCssStyles({ marginLeft: "6px" });
        btn.onclick = async () => {
          notice.hide();
          await a.onClick();
        };
      }
    }
  }

  if (mode === "obsidian") return;
  if (!Platform.isDesktopApp) return;

  try {
    const anyWindow = window as unknown;
    if (typeof anyWindow.Notification === "function") {
      const n = new anyWindow.Notification(title, { body });
      // کلیک روی نوتیفیکیشن بومی → فعال‌سازی پنجره Obsidian
      n.onclick = () => {
        (app as unknown).workspace?.containerEl?.win?.focus?.();
      };
      return;
    }
  } catch { /* fallthrough */ }

  // fallback: osascript (بدون دکمه)
  try {
    const proc = (window as unknown).require?.("child_process");
    if (proc?.exec) {
      const safeBody = body.replace(/"/g, '\\"');
      const safeTitle = title.replace(/"/g, '\\"');
      proc.exec(`osascript -e 'display notification "${safeBody}" with title "${safeTitle}"'`);
    }
  } catch { /* ignore */ }
}

/** اعلان مرورهای عقب‌افتاده با اکشن‌های باز کردن والت / تعویق */
export function notifyOverdueWithActions(
  app: App,
  count: number,
  mode: NotifyMode,
  onOpenVault: () => void | Promise<void>,
  onSnooze: () => void | Promise<void>
): void {
  notify(
    app,
    "Recovery Engine",
    `⚠️ ${count} مرور عقب‌افتاده داری.`,
    mode,
    [
      { label: "باز کردن والت", onClick: onOpenVault },
      { label: "تعویق", onClick: onSnooze },
    ]
  );
}
