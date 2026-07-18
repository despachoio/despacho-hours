const { app, BrowserWindow, Menu, session, shell } = require("electron");

const KAIRO_URL = "https://kairo.despacho.io";
const KAIRO_ORIGIN = new URL(KAIRO_URL).origin;
const EXTERNAL_HOSTS = new Set([
  "despacho.io",
  "www.despacho.io",
  "checkout.stripe.com",
  "pay.stripe.com",
]);

function isKairoUrl(rawUrl) {
  try {
    return new URL(rawUrl).origin === KAIRO_ORIGIN;
  } catch {
    return false;
  }
}

function isAllowedExternalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && EXTERNAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

async function openAllowedExternalUrl(rawUrl) {
  if (!isAllowedExternalUrl(rawUrl)) return;
  await shell.openExternal(rawUrl);
}

function createWindow() {
  const window = new BrowserWindow({
    title: "Kairo",
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#f8fafc",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: false,
      safeDialogs: true,
    },
  });

  window.once("ready-to-show", () => window.show());

  window.webContents.on("will-navigate", (event, targetUrl) => {
    if (isKairoUrl(targetUrl)) return;
    event.preventDefault();
    void openAllowedExternalUrl(targetUrl);
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isKairoUrl(url)) {
      void window.loadURL(url);
    } else {
      void openAllowedExternalUrl(url);
    }
    return { action: "deny" };
  });

  void window.loadURL(KAIRO_URL);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on(
  "certificate-error",
  (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(false);
  },
);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
