@echo off
chcp 65001 >nul
echo ========================================
echo   法律合规审查系统 - 一键部署脚本
echo ========================================
echo.

REM 检查是否安装了 Node.js
echo [1/4] 检查环境...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未找到 Node.js，请先安装：https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js 已安装

REM 检查是否安装了 Vercel CLI
echo.
echo [2/4] 检查 Vercel CLI...
vercel --version >nul 2>&1
if errorlevel 1 (
    echo 📦 正在安装 Vercel CLI...
    npm install -g vercel
    if errorlevel 1 (
        echo ❌ Vercel 安装失败
        pause
        exit /b 1
    )
)
echo ✅ Vercel CLI 已安装

REM 进入项目目录
echo.
echo [3/4] 准备部署...
cd /d "%~dp0"
echo 📂 当前目录: %cd%

REM 清理旧的构建
if exist "out" rd /s /q "out" 2>nul
if exist ".next" rd /s /q ".next" 2>nul

REM 构建项目
echo.
echo [4/4] 部署到互联网...
echo 🚀 准备启动 Vercel 部署...
echo.
echo ========================================
echo   请按照 Vercel 的提示完成部署
echo   - 首次使用需要登录邮箱
echo   - 选择 Y 部署到生产环境
echo ========================================
echo.

pause

REM 部署
vercel --prod

echo.
echo ========================================
echo ✅ 部署完成！
echo.
echo 请查看上方显示的 URL 地址，
echo 那就是您的系统在互联网上的地址！
echo ========================================

pause
