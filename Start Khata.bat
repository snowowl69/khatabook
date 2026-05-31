@echo off
title Khata - Billing & Stock Management
color 0A

:: ── Set project path ──
set "PROJECT=c:\Users\Raghav\Desktop\raga\khata"
set "LOG=%PROJECT%\launch_history.log"

:: ── Log this launch ──
echo ================================================== >> "%LOG%"
echo   Khata Launched >> "%LOG%"
echo   Date : %date% >> "%LOG%"
echo   Time : %time% >> "%LOG%"
echo   User : %username% >> "%LOG%"
echo ================================================== >> "%LOG%"

:: ── Show splash ──
echo.
echo   ╔═══════════════════════════════════════════════╗
echo   ║                                               ║
echo   ║          K H A T A                            ║
echo   ║          Billing ^& Stock Management           ║
echo   ║                                               ║
echo   ║   Starting the application...                 ║
echo   ║   Do NOT close this window while app runs.    ║
echo   ║                                               ║
echo   ╚═══════════════════════════════════════════════╝
echo.
echo   [%date% %time%] Launch logged to launch_history.log
echo.

:: ── Start the app ──
cd /d "%PROJECT%"
npm run dev

:: ── Log shutdown ──
echo   Closed : %date% %time% >> "%LOG%"
echo -------------------------------------------------- >> "%LOG%"
echo.

echo.
echo   Khata has been closed. You can close this window.
pause
