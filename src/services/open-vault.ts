import { Notice, Platform } from "obsidian";

/**
 * باز کردن والت با URI از طریق macOS (دستور open).
 * روی ویندوز/لینوکس از window.open استفاده می‌کند.
 */
export function openVaultUri(vaultId: string): void {
  const uri = `obsidian://open?vault=${encodeURIComponent(vaultId)}`;

  if (Platform.isMacOS) {
    try {
      const req = (window as unknown).require;
      if (typeof req === "function") {
        const { exec } = req("child_process");
        // استفاده از open برای اینکه macOS URI را به Obsidian برساند
        exec(`open "${uri}"`, (err: unknown) => {
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

  // fallback: window.open
  window.open(uri, "_blank");
}
