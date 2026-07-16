const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  session,
  shell,
  Tray,
} = require("electron");
const path = require("path");

const KAIRO_URL = "https://kairo.despacho.io";
const TIMER_URL = `${KAIRO_URL}/desktop-timer`;
const KAIRO_ORIGIN = new URL(KAIRO_URL).origin;
const EXTERNAL_HOSTS = new Set([
  "kairo.despacho.io",
  "despacho.io",
  "www.despacho.io",
]);

let timerWindow = null;
let tray = null;
let isQuitting = false;

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

function positionTimerWindow() {
  if (!timerWindow || !tray) return;
  const trayBounds = tray.getBounds();
  const windowBounds = timerWindow.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: Math.round(trayBounds.x),
    y: Math.round(trayBounds.y),
  });
  const workArea = display.workArea;
  const x = Math.min(
    Math.max(
      Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2),
      workArea.x,
    ),
    workArea.x + workArea.width - windowBounds.width,
  );
  const y =
    process.platform === "darwin"
      ? workArea.y
      : workArea.y + workArea.height - windowBounds.height;
  timerWindow.setPosition(x, y, false);
}

function showTimerWindow() {
  if (!timerWindow) return;
  positionTimerWindow();
  timerWindow.show();
  timerWindow.focus();
}

function toggleTimerWindow() {
  if (!timerWindow) return;
  if (timerWindow.isVisible() && timerWindow.isFocused()) {
    timerWindow.hide();
  } else {
    showTimerWindow();
  }
}

function createTimerWindow() {
  timerWindow = new BrowserWindow({
    title: "Kairo Timer",
    width: 420,
    height: 700,
    minWidth: 380,
    minHeight: 620,
    maxWidth: 520,
    show: false,
    resizable: true,
    fullscreenable: false,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: false,
      safeDialogs: true,
    },
  });

  timerWindow.once("ready-to-show", showTimerWindow);
  timerWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    timerWindow?.hide();
  });
  timerWindow.on("closed", () => {
    timerWindow = null;
  });

  timerWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (isKairoUrl(targetUrl)) return;
    event.preventDefault();
    void openAllowedExternalUrl(targetUrl);
  });
  timerWindow.webContents.setWindowOpenHandler(({ url }) => {
    void openAllowedExternalUrl(url);
    return { action: "deny" };
  });

  void timerWindow.loadURL(TIMER_URL);
}

function createTray() {
  const iconFile =
    process.platform === "darwin" ? "kairo-icon-mac.png" : "kairo-icon.png";
  const size = process.platform === "darwin" ? 18 : 20;
  const icon = nativeImage
    .createFromPath(path.join(process.resourcesPath, "assets", iconFile))
    .resize({ width: size, height: size });
  tray = new Tray(icon);
  tray.setToolTip("Kairo Timer");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Timer", click: showTimerWindow },
      {
        label: "Open Full Kairo",
        click: () => void openAllowedExternalUrl(KAIRO_URL),
      },
      { type: "separator" },
      {
        label: "Logout",
        click: () => {
          showTimerWindow();
          timerWindow?.webContents.send("kairo:logout-requested");
        },
      },
      { type: "separator" },
      {
        label: "Quit Kairo Timer",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", toggleTimerWindow);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", showTimerWindow);
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    if (process.platform === "darwin") app.dock?.hide();

    session.defaultSession.setPermissionRequestHandler(
      (_webContents, _permission, callback) => callback(false),
    );
    session.defaultSession.setPermissionCheckHandler(() => false);

    ipcMain.handle("kairo:open-full-app", () =>
      openAllowedExternalUrl(KAIRO_URL),
    );
    createTray();
    createTimerWindow();
  });
}

app.on(
  "certificate-error",
  (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(false);
  },
);

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // The timer intentionally remains available from the tray.
});
