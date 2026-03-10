@echo off
REM LocatorLens - Quick installer for Windows (repo users)
REM Delegates to extension\installers\install_host.bat

set "SCRIPT_DIR=%~dp0"
call "%SCRIPT_DIR%extension\installers\install_host.bat" %*
