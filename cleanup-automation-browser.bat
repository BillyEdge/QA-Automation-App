@echo off
REM This script ONLY kills the QA Automation's headless browser
REM It does NOT affect your regular Chrome browser

echo.
echo ====================================================
echo 🧹 Cleaning up QA Automation Browser Session...
echo ====================================================
echo.

REM Kill only headless/test browsers (these are isolated instances)
taskkill /F /IM chromium.exe 2>nul
taskkill /F /IM msedgedriver.exe 2>nul

REM Delete the CDP endpoint file (tells system to start a fresh browser)
if exist ".browser-cdp-endpoint" (
    del ".browser-cdp-endpoint"
    echo ✅ Deleted stale browser endpoint file
)

echo ✅ Cleanup complete! Starting fresh...
echo.
echo Note: Your regular Chrome browser is NOT affected
echo This only kills the automation tool's headless browser
echo.

timeout /t 2 >nul
