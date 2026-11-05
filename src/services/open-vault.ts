import { Notice, Platform } from "obsidian";

/**
 * باز کردن والت با URI از طریق macOS (دستور open).
 * روی اندروید و موبایل از window.open استفاده می‌کند.
 */
export function openVaultUri(vaultId: string): void {
  const uri = `obsidian://open?vault=${encodeURIComponent(vaultId)}`;

  if (Platform.isDesktopApp) {
    try {
      const req = (window as any).require;
      if (typeof req === "function") {
        const { exec } = req("child_process");
        exec(`open "${uri}"`, (err: any) => {
          if (err) {
            console.error("[RecoveryEngine] open vault error:", err);
            new Notice("خطا در باز کردن والت.");
          }
        });
        return;
      }
    } catch (e) {
      console.error("[RecoveryEngine] open error:", e);
    }
  }

  // روی موبایل یا اگر exec کار نکرد، از window.open استفاده میکنیم
  window.open(uri, "_blank");
}
