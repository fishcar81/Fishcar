@echo off
setlocal EnableExtensions
set "GAME_FILE=%~dp0index.html"
set "CHROME_X64=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME_X86=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set "PROFILE_DIR=%TEMP%\GoldenScapegoatLocalProfile"

if not exist "%GAME_FILE%" (
  echo Game file was not found:
  echo %GAME_FILE%
  pause
  exit /b 1
)

if exist "%CHROME_X64%" (
  start "" "%CHROME_X64%" --new-window --user-data-dir="%PROFILE_DIR%" --allow-file-access-from-files "%GAME_FILE%"
  exit /b 0
)

if exist "%CHROME_X86%" (
  start "" "%CHROME_X86%" --new-window --user-data-dir="%PROFILE_DIR%" --allow-file-access-from-files "%GAME_FILE%"
  exit /b 0
)

echo Google Chrome was not found. Please install Chrome or open index.html manually.
pause
exit /b 1