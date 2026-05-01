@echo off
setlocal EnableDelayedExpansion

echo.
echo ==================================================
echo   LocatorLens Native Host Installer (Windows)
echo ==================================================
echo.

:: Default extension ID - update this to your Chrome Web Store ID
set "EXTENSION_ID=ajcdeghbgfonhphbnkmbmocekkmdeoke"
set "HOST_NAME=com.locatorlens.host"
set "INSTALL_BASE=%USERPROFILE%\.locatorlens"
set "NATIVE_HOST_DIR=%INSTALL_BASE%\native-host"
set "BACKEND_INSTALL_DIR=%INSTALL_BASE%\backend"
set "COMPANION_VERSION=__COMPANION_VERSION__"
set "COMPANION_URL=__COMPANION_URL__"
set "COMPANION_SHA256=__COMPANION_SHA256__"
set "COMPANION_EMBEDDED=0"

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
set "CURRENT_DIR=%CD%"

:: Normalize the repository root to an absolute path relative to the script location.
set "REPO_ROOT=%SCRIPT_DIR%..\.."
for %%I in ("%REPO_ROOT%") do set "REPO_ROOT=%%~fI"

:: Fallback: if repo root detection fails, use the current working directory.
if not exist "%REPO_ROOT%\native-host\launcher.js" (
    set "REPO_ROOT=!CURRENT_DIR!"
    for %%I in ("!REPO_ROOT!") do set "REPO_ROOT=%%~fI"
)

set "REPO_BACKEND=%REPO_ROOT%\backend"
set "REPO_LAUNCHER=%REPO_ROOT%\native-host\launcher.js"

if exist "%REPO_BACKEND%\server.js" (
    echo   Found backend in repository
    if not exist "%BACKEND_INSTALL_DIR%" mkdir "%BACKEND_INSTALL_DIR%"
    xcopy /E /I /Y /Q "%REPO_BACKEND%" "%BACKEND_INSTALL_DIR%" >nul
    echo   OK Copied backend to %BACKEND_INSTALL_DIR%
) else (
    if exist "%BACKEND_INSTALL_DIR%\server.js" (
        echo   OK Backend already installed
    ) else (
        set "TMP_DIR=%TEMP%\locatorlens-companion-%RANDOM%"
        set "ZIP_PATH=!TMP_DIR!\locatorlens-companion.zip"
        set "EXTRACT_DIR=!TMP_DIR!\extract"
        mkdir "!TMP_DIR!" >nul 2>&1
        mkdir "!EXTRACT_DIR!" >nul 2>&1

        if "!COMPANION_EMBEDDED!"=="1" (
            echo   Backend files not found locally. Using bundled LocatorLens companion %COMPANION_VERSION%...
            call :write_embedded_companion "!ZIP_PATH!"
            if errorlevel 1 (
                echo   ERROR: Could not write bundled companion archive.
                pause
                exit /b 1
            )
        ) else (
            echo   Backend files not found locally. Downloading LocatorLens companion %COMPANION_VERSION%...
            echo   URL: !COMPANION_URL!
            if "!COMPANION_URL!"=="" (
                echo   ERROR: Companion release URL was not baked into this installer.
                echo   Download the installer from the LocatorLens Options page.
                pause
                exit /b 1
            )
            echo !COMPANION_URL! | find "__" >nul
            if not errorlevel 1 (
                echo   ERROR: Companion release metadata was not baked into this installer.
                echo   Download the installer from the LocatorLens Options page.
                pause
                exit /b 1
            )

            where powershell >nul 2>&1
            if errorlevel 1 (
                echo   ERROR: PowerShell is required to download and extract the companion release.
                pause
                exit /b 1
            )

            powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri '!COMPANION_URL!' -OutFile '!ZIP_PATH!' -UseBasicParsing"
            if errorlevel 1 (
                echo   ERROR: Companion download failed.
                pause
                exit /b 1
            )
        )

        powershell -NoProfile -ExecutionPolicy Bypass -Command "$expected='!COMPANION_SHA256!'.ToLowerInvariant(); $actual=(Get-FileHash -Path '!ZIP_PATH!' -Algorithm SHA256).Hash.ToLowerInvariant(); if ($actual -ne $expected) { Write-Host ('Checksum mismatch. Expected ' + $expected + ' got ' + $actual); exit 2 }"
        if errorlevel 1 (
            echo   ERROR: Companion checksum verification failed.
            pause
            exit /b 1
        )

        powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '!ZIP_PATH!' -DestinationPath '!EXTRACT_DIR!' -Force"
        if errorlevel 1 (
            echo   ERROR: Companion extraction failed.
            pause
            exit /b 1
        )

        set "DOWNLOADED_BACKEND="
        for /f "delims=" %%F in ('dir /b /s "!EXTRACT_DIR!\server.js" 2^>nul') do (
            echo %%F | findstr /i "\\backend\\server.js$" >nul
            if not errorlevel 1 set "DOWNLOADED_BACKEND=%%~dpF"
        )

        set "DOWNLOADED_LAUNCHER="
        for /f "delims=" %%F in ('dir /b /s "!EXTRACT_DIR!\launcher.js" 2^>nul') do (
            echo %%F | findstr /i "\\native-host\\launcher.js$" >nul
            if not errorlevel 1 set "DOWNLOADED_LAUNCHER=%%F"
        )

        if not defined DOWNLOADED_BACKEND (
            echo   ERROR: Companion archive did not contain backend files.
            pause
            exit /b 1
        )
        if not exist "!DOWNLOADED_BACKEND!\server.js" (
            echo   ERROR: Companion archive did not contain backend files.
            pause
            exit /b 1
        )

        if not exist "%BACKEND_INSTALL_DIR%" mkdir "%BACKEND_INSTALL_DIR%"
        xcopy /E /I /Y /Q "!DOWNLOADED_BACKEND!" "%BACKEND_INSTALL_DIR%" >nul
        if errorlevel 1 (
            echo   ERROR: Could not install backend files.
            pause
            exit /b 1
        )
        if defined DOWNLOADED_LAUNCHER set "REPO_LAUNCHER=!DOWNLOADED_LAUNCHER!"
        echo   OK Downloaded and installed companion backend
    )
)

:: Install npm dependencies
echo   Installing backend dependencies...
pushd "%BACKEND_INSTALL_DIR%"
set "NPM_LOG=%INSTALL_BASE%\npm-install.log"
call npm install --omit=dev --no-audit --no-fund > "%NPM_LOG%" 2>&1
if errorlevel 1 (
    popd
    echo   ERROR: npm install failed.
    echo   Full npm log: %NPM_LOG%
    pause
    exit /b 1
)
popd
echo   OK Dependencies installed

:: Step 4: Create native host files
echo [4/6] Creating native host files...
if not exist "%NATIVE_HOST_DIR%" mkdir "%NATIVE_HOST_DIR%"

:: __EMBEDDED_LAUNCHER_JS__
if not exist "%NATIVE_HOST_DIR%\launcher.js" (
    if exist "%REPO_LAUNCHER%" (
        copy /Y "%REPO_LAUNCHER%" "%NATIVE_HOST_DIR%\launcher.js" >nul
    )
)
if not exist "%NATIVE_HOST_DIR%\launcher.js" (
    echo   ERROR: launcher.js not found.
    echo   Download the installer from the extension Options page.
    pause
    exit /b 1
)
echo   OK launcher.js installed

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

:: Create a temporary .reg file for more reliable registry import
set "TEMP_REG=%TEMP%\locatorlens_host_%RANDOM%.reg"

(
echo Windows Registry Editor Version 5.00
echo.
echo [HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%]
echo @="%MANIFEST_PATH:\=\\%"
echo.
echo [HKEY_CURRENT_USER\Software\Microsoft\Edge\NativeMessagingHosts\%HOST_NAME%]
echo @="%MANIFEST_PATH:\=\\%"
echo.
echo [HKEY_CURRENT_USER\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\%HOST_NAME%]
echo @="%MANIFEST_PATH:\=\\%"
) > "%TEMP_REG%"

:: Import the registry file
reg import "%TEMP_REG%" >nul 2>&1
if errorlevel 1 (
    echo   WARNING: Registry import via native method failed. Attempting direct REG ADD...
    REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f
    REG ADD "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f
    REG ADD "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\%HOST_NAME%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f
) else (
    echo   OK Google Chrome
    echo   OK Microsoft Edge
    echo   OK Brave Browser
)

:: Clean up temp file
if exist "%TEMP_REG%" del /Q "%TEMP_REG%" >nul 2>&1
if defined TMP_DIR if exist "!TMP_DIR!" rmdir /S /Q "!TMP_DIR!" >nul 2>&1

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
exit /b 0

:write_embedded_companion
set "COMPANION_ZIP_OUT=%~1"
> "%TEMP%\ll_companion_b64.txt" (
:: __EMBEDDED_COMPANION_ZIP__
)
node -e "var fs=require('fs');var b=fs.readFileSync(process.env.TEMP+'/ll_companion_b64.txt','utf8').replace(/\s/g,'');fs.writeFileSync(process.argv[1],Buffer.from(b,'base64'))" "%COMPANION_ZIP_OUT%"
set "WRITE_COMPANION_RESULT=%ERRORLEVEL%"
del "%TEMP%\ll_companion_b64.txt" >nul 2>&1
exit /b %WRITE_COMPANION_RESULT%
