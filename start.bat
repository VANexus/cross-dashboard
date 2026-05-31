@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo  ╔══════════════════════════════════════╗
echo  ║       FlowMind  一键启动脚本         ║
echo  ╚══════════════════════════════════════╝
echo.

set "PROJECT_ROOT=%~dp0"

:: ========== 1. 检查并安装 bun ==========
echo [1/3] 检查 bun 是否已安装...
where bun >nul 2>&1
if %errorlevel% neq 0 (
    echo       bun 未找到，正在通过 PowerShell 自动安装...
    powershell -NoProfile -Command "irm bun.sh/install.ps1 | iex"
    set "PATH=%USERPROFILE%\.bun\bin;%LOCALAPPDATA%\bun\bin;%PATH%"
    where bun >nul 2>&1
    if !errorlevel! neq 0 (
        echo [错误] bun 安装失败，请手动安装后重试。
        echo        运行: powershell -c "irm bun.sh/install.ps1 | iex"
        pause
        exit /b 1
    )
    echo       bun 安装完成。
) else (
    echo       bun 已就绪。
)
echo.

:: ========== 2. 安装依赖并构建 ==========
echo [2/3] 安装依赖并构建...
echo.
cd /d "%PROJECT_ROOT%"

call bun install
if %errorlevel% neq 0 (
    echo [错误] bun install 失败，请检查网络连接。
    pause
    exit /b 1
)
echo.
echo       依赖安装完成，开始构建...
echo.

call bun run build
if %errorlevel% neq 0 (
    echo [错误] 构建失败，请检查代码是否有错误。
    pause
    exit /b 1
)
echo.

:: ========== 3. 启动服务 ==========
echo [3/3] 启动服务...
echo.
echo  ╔══════════════════════════════════════╗
echo  ║         服务已启动！                  ║
echo  ║                                      ║
echo  ║  地址: http://localhost:3000          ║
echo  ║                                      ║
echo  ║  按 Ctrl+C 可关闭服务                ║
echo  ╚══════════════════════════════════════╝
echo.

call bun run start
