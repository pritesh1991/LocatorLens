@echo off
setlocal EnableDelayedExpansion

echo.
echo ==================================================
echo   LocatorLens Native Host Installer (Windows)
echo ==================================================
echo.

:: Default extension ID - update this to your Chrome Web Store ID
set "EXTENSION_ID=ajcdeghbgfonhphbnkmbmocekkmdeoke"
set "HOST_NAME=com.locatorbuilder.host"
set "INSTALL_BASE=%USERPROFILE%\.locatorlens"
set "NATIVE_HOST_DIR=%INSTALL_BASE%\native-host"
set "BACKEND_INSTALL_DIR=%INSTALL_BASE%\backend"

:: Check for --extension-id argument
:parse_args
if "%~1"=="--extension-id" (
    set "EXTENSION_ID=%~2"
    shift
    shift
    goto :parse_args
)

echo Extension ID: %EXTENSION_ID%
echo Install directory: %INSTALL_BASE%
echo.

:: Step 1: Check Node.js
echo [1/6] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Node.js not found.
    echo   Please install Node.js v18+ from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo   OK Node.js %NODE_VERSION%

:: Step 2: Check npm
echo [2/6] Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo   ERROR: npm not found.
    pause
    exit /b 1
)
echo   OK npm found

:: Step 3: Set up backend
echo [3/6] Setting up backend...

:: Detect if running from inside repo (installer is at extension\installers\install_host.bat)
set "SCRIPT_DIR=%~dp0"
set "REPO_BACKEND=%SCRIPT_DIR%..\..\backend"

if exist "%REPO_BACKEND%\server.js" (
    echo   Found backend in repository
    if not exist "%BACKEND_INSTALL_DIR%" mkdir "%BACKEND_INSTALL_DIR%"
    xcopy /E /I /Y /Q "%REPO_BACKEND%" "%BACKEND_INSTALL_DIR%" >nul
    echo   OK Copied backend to %BACKEND_INSTALL_DIR%
) else (
    if exist "%BACKEND_INSTALL_DIR%\server.js" (
        echo   OK Backend already installed
    ) else (
        echo   ERROR: Backend files not found.
        echo   Please download the full release from:
        echo   https://github.com/YOUR_USERNAME/locatorlens/releases/latest
        echo   Extract it and run this installer from inside the extracted folder.
        pause
        exit /b 1
    )
)

:: Install npm dependencies
echo   Installing backend dependencies...
pushd "%BACKEND_INSTALL_DIR%"
call npm install --omit=dev --silent
popd
echo   OK Dependencies installed

:: Step 4: Create native host files
echo [4/6] Creating native host files...
if not exist "%NATIVE_HOST_DIR%" mkdir "%NATIVE_HOST_DIR%"

:: Copy launcher.js from native-host directory if available
set "REPO_LAUNCHER=%SCRIPT_DIR%..\..\native-host\launcher.js"
if exist "%REPO_LAUNCHER%" (
    copy /Y "%REPO_LAUNCHER%" "%NATIVE_HOST_DIR%\launcher.js" >nul
    echo   OK Copied launcher.js
) else (
    echo   ERROR: launcher.js not found at %REPO_LAUNCHER%
    echo   Please run this installer from inside the extracted release folder.
    pause
    exit /b 1
)

:: Write host.bat wrapper
echo @echo off > "%NATIVE_HOST_DIR%\host.bat"
echo node "%NATIVE_HOST_DIR%\launcher.js" >> "%NATIVE_HOST_DIR%\host.bat"

echo   OK Native host files created

:: Step 5: Write manifest
echo [5/6] Creating manifest...
(
echo {
echo   "name": "%HOST_NAME%",
echo   "description": "LocatorLens Native Messaging Host",
echo   "path": "%NATIVE_HOST_DIR:\=\\%\\host.bat",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://%EXTENSION_ID%/"
echo   ]
echo }
) > "%NATIVE_HOST_DIR%\%HOST_NAME%.json"
echo   OK Manifest created

:: Step 6: Register in Windows registry
echo [6/6] Registering with browsers...

set "MANIFEST_PATH=%NATIVE_HOST_DIR%\%HOST_NAME%.json"

:: Google Chrome
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
echo   OK Google Chrome

:: Microsoft Edge
REG ADD "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
echo   OK Microsoft Edge

:: Brave Browser
REG ADD "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul 2>&1
echo   OK Brave Browser

echo.
echo ==================================================
echo   Installation Complete!
echo ==================================================
echo.
echo Installed to: %INSTALL_BASE%
echo.
echo NEXT STEPS:
echo   1. Install Appium (if not already):
echo      npm install -g appium
echo      appium driver install uiautomator2   (for Android)
echo      appium driver install xcuitest        (for iOS - macOS only)
echo.
echo   2. Go to chrome://extensions
echo   3. Find LocatorLens and click the reload icon
echo   4. Click the LocatorLens extension icon
echo   5. Click 'Start Servers' and connect your device
echo.
echo Logs: %USERPROFILE%\.locatorlens\native-host.log
echo.
pause
