const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kairoDesktop", {
  openFullApp: () => ipcRenderer.invoke("kairo:open-full-app"),
  getSessionId: () => ipcRenderer.invoke("kairo:get-session-id"),
  onLogoutRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("kairo:logout-requested", listener);
    return () => ipcRenderer.removeListener("kairo:logout-requested", listener);
  },
  onShutdownRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("kairo:shutdown-requested", listener);
    return () => ipcRenderer.removeListener("kairo:shutdown-requested", listener);
  },
  shutdownComplete: () => ipcRenderer.send("kairo:shutdown-complete"),
});
