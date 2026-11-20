@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ==============================================
echo   KnitScape 一键打包 Windows 安装程序
echo ==============================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 没有找到 Node.js，请先安装 Node.js LTS 版本：https://nodejs.org
  pause
  exit /b 1
)

rem 使用国内镜像下载 Electron，速度更快
set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
set "ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/"

if not exist "node_modules\electron-builder" (
  echo [1/3] 第一次打包，正在安装打包工具，可能需要几分钟...
  call npm install --registry=https://registry.npmmirror.com --no-audit --no-fund
  if errorlevel 1 (
    echo [错误] 打包工具安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
) else (
  echo [1/3] 打包工具已安装，跳过。
)

echo [2/3] 正在构建网页并生成安装程序...
call npm run dist:win
if errorlevel 1 (
  echo [错误] 打包失败，请把上面的报错信息发给 Claude 帮你看。
  pause
  exit /b 1
)

echo.
echo [3/3] 完成！安装程序在 release 文件夹里：KnitScape-Setup-版本号.exe
explorer "%~dp0release"
pause
