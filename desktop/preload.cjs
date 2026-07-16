const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kairoDesktop", {
  openFullApp: () => ipcRenderer.invoke("kairo:open-full-app"),
  onLogoutRequested: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("kairo:logout-requested", listener);
    return () => ipcRenderer.removeListener("kairo:logout-requested", listener);
  },
});
