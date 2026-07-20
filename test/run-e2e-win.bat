@echo off
REM 智能标签管家 — Playwright E2E 测试 (Windows 一键运行)
echo ========================================
echo   Tab Manager E2E Test (Windows)
echo ========================================
echo.

set TEST_DIR=C:\Users\23395\AppData\Local\Temp\tab-manage-test

REM 1. 先清理旧 Chrome 进程
echo [1/5] 清理旧 Chrome 进程...
taskkill /f /im chrome.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM 2. 确保构建产物存在
echo [2/5] 复制构建产物...
if not exist "%TEST_DIR%\build\manifest.json" (
    echo 构建产物不存在！请先在 WSL 中运行 pnpm build
    pause
    exit /b 1
)

REM 3. 确保 Playwright 和测试脚本已安装
echo [3/5] 检查 Playwright...
if not exist "%TEST_DIR%\node_modules\playwright" (
    cd /d "%TEST_DIR%"
    call npm init -y >nul 2>&1
    call npm install playwright >nul 2>&1
)

REM 4. 复制最新测试脚本
echo [4/5] 准备测试脚本...
copy /y "\\wsl.localhost\Ubuntu\home\hermes\tab-manage\test\ui-blackbox.win.cjs" "%TEST_DIR%\ui-blackbox.win.cjs" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ⚠️  无法从 WSL 复制脚本，使用已有版本
)

REM 5. 执行测试
echo [5/5] 启动 Playwright E2E 测试...
echo.
cd /d "%TEST_DIR%"
node ui-blackbox.win.cjs
set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE% equ 0 (
    echo ✅ 测试完成！
) else (
    echo ⚠️  测试完成（部分失败）
)

pause
