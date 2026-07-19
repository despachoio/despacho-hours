declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

export function isNativeKairoApp() {
  if (typeof window === "undefined") return false;

  return Boolean(
    window.Capacitor?.isNativePlatform?.() ||
      window.Capacitor?.getPlatform?.() === "ios",
  );
}

export function isMobileDevice() {
  if (typeof navigator === "undefined") return false;

  const userAgent = navigator.userAgent || "";
  const reportsMobileDevice =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      userAgent,
    );
  const isIPadRequestingDesktopSite =
    /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;

  return reportsMobileDevice || isIPadRequestingDesktopSite;
}

export function requiresAdminMobileAccess() {
  return isNativeKairoApp() || isMobileDevice();
}
