@echo off
REM Syncs static files from the VS Code workspace to the resolved junction path
REM that Flask actually serves from. Run this after editing CSS/JS/HTML files,
REM or keep it running in a terminal during development.

set SRC=h:\UIEX\idea-radar-system\web\static
set DST=h:\tmp\idea-radar-system\web\static

echo Syncing %SRC% -> %DST%
xcopy /Y /E /Q "%SRC%\*.*" "%DST%\"
echo Done. Files synced.
