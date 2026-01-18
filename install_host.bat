@echo off
SETLOCAL EnableDelayedExpansion

REM ====================================================================
REM LocatorLens Native Host Installation Script - Windows
REM ====================================================================

echo.
echo ========================================
echo LocatorLens Native Host Installer
echo ========================================
echo.

SET HOST_NAME=com.locatorbuilder.host
SET CHROME_DIR=%LOCALAPPDATA%\Google\Chrome\User Data\NativeMessagingHosts
SET EDGE_DIR=%LOCALAPPDATA%\Microsoft\Edge\User Data\NativeMessagingHosts

REM Get the directory where this script is located
SET PROJECT_DIR=%~dp0
SET NATIVE_HOST_DIR=%PROJECT_DIR%native-host

echo [1/4] Checking directories...
if not exist "%NATIVE_HOST_DIR%" (
    echo ERROR: native-host directory not found!
    echo Please run this script from the LocatorLens project root.
    pause
    exit /b 1
)

echo [2/4] Creating native host wrapper script...
REM Create host.bat wrapper with Node.js detection
(
echo @echo off
echo REM Find Node.js dynamically
echo where node ^>nul 2^>^&1
echo if %%ERRORLEVEL%% == 0 ^(
echo   node "%%~dp0launcher.js"
echo ^) else ^(
echo   REM Check common installation paths
echo   if exist "C:\Program Files\nodejs\node.exe" ^(
echo     "C:\Program Files\nodejs\node.exe" "%%~dp0launcher.js"
echo   ^) else if exist "C:\Program Files ^(x86^)\nodejs\node.exe" ^(
echo     "C:\Program Files ^(x86^)\nodejs\node.exe" "%%~dp0launcher.js"  
echo   ^) else if exist "%%LOCALAPPDATA%%\Programs\nodejs\node.exe" ^(
echo     "%%LOCALAPPDATA%%\Programs\nodejs\node.exe" "%%~dp0launcher.js"
echo   ^) else ^(
echo     echo ERROR: Node.js not found! Please install Node.js ^>^&2
echo     exit /b 1
echo   ^)
echo ^)
) > "%NATIVE_HOST_DIR%\host.bat"

echo [3/4] Creating manifest file...
REM Create manifest JSON
(
echo {
echo   "name": "%HOST_NAME%",
echo   "description": "LocatorLens Native Messaging Host",
echo   "path": "%NATIVE_HOST_DIR%\\host.bat",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://ajcdeghbgfonhphbnkmbmocekkmdeoke/"
echo   ]
echo }
) > "%NATIVE_HOST_DIR%\%HOST_NAME%.json"

echo [4/4] Installing native host...

REM Install for Chrome
if exist "%LOCALAPPDATA%\Google\Chrome" (
    if not exist "%CHROME_DIR%" mkdir "%CHROME_DIR%"
    copy /Y "%NATIVE_HOST_DIR%\%HOST_NAME%.json" "%CHROME_DIR%\" >nul
    echo   ^> Chrome: Installed
) else (
    echo   ^> Chrome: Not found (skipped^)
)

REM Install for Edge
if exist "%LOCALAPPDATA%\Microsoft\Edge" (
    if not exist "%EDGE_DIR%" mkdir "%EDGE_DIR%"
    copy /Y "%NATIVE_HOST_DIR%\%HOST_NAME%.json" "%EDGE_DIR%\" >nul
    echo   ^> Edge: Installed
) else (
    echo   ^> Edge: Not found (skipped^)
)

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Manifest: %NATIVE_HOST_DIR%\%HOST_NAME%.json
echo Host script: %NATIVE_HOST_DIR%\host.bat
echo.
echo NEXT STEPS:
echo 1. Reload the LocatorLens extension in Chrome/Edge
echo 2. Click on the extension icon
echo 3. Try starting the servers
echo.
pause
