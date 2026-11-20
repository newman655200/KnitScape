// KnitScape 桌面版主程序（Electron）。
// 作用：把 `npm run build` 生成的 dist 网页装进一个独立窗口里运行，
// 用户不需要安装 Node.js，也不需要打开浏览器。

const { app, BrowserWindow, protocol, net, shell, Menu } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// 网页文件所在位置：开发时是项目里的 dist，打包后也在安装目录的 dist 里。
const DIST_DIR = path.join(__dirname, "..", "dist");
const SCHEME = "app";

// 用自定义的 app:// 地址代替 file://，
// 这样网页里的模块脚本、Web Worker 和 fetch 读取材质文件都能正常工作。
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

function registerAppProtocol() {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const relative = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
    const filePath = path.normalize(path.join(DIST_DIR, relative));
    // 只允许读取 dist 里的文件
    if (filePath !== DIST_DIR && !filePath.startsWith(DIST_DIR + path.sep)) {
      return new Response("Not found", { status: 404 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "KnitScape",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  // 外部链接（参考资料、vscode:// 等）交给系统默认程序打开，不在软件窗口里跳转
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`${SCHEME}://`)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${SCHEME}://`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  win.loadURL(`${SCHEME}://knitscape/index.html`);
}

// 同一时间只开一个 KnitScape 窗口
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    registerAppProtocol();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
