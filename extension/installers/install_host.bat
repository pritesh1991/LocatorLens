@echo off
setlocal

echo ==================================================
echo   LocatorLens Native Host Installer (Windows)
echo ==================================================
echo.

set "EXTENSION_ID=ajcdeghbgfonhphbnkmbmocekkmdeoke"
set "INSTALL_DIR=%USERPROFILE%\.locatorlens\native-host"
set "MANIFEST_PATH=%INSTALL_DIR%\manifest.json"
set "HOST_PATH=%INSTALL_DIR%\host.bat"
set "LAUNCHER_PATH=%INSTALL_DIR%\launcher.js"
set "TEMP_B64=%INSTALL_DIR%\launcher.b64"

echo Creating installation directory...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo Writing launcher script components...
if exist "%TEMP_B64%" del "%TEMP_B64%"
echo IyEvdXNyL2Jpbi9lbnYgbm9kZQoKY29uc3QgZnMgPSByZXF1aXJlKCdmcycpOwpj>> "%TEMP_B64%"
echo b25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpOwpjb25zdCB7IHNwYXduLCBleGVj>> "%TEMP_B64%"
echo U3luYyB9ID0gcmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpOwoKLy8gQ29uZmlndXJh>> "%TEMP_B64%"
echo dGlvbgpjb25zdCBFWFRfSUQgPSAnYWpjZGVnaGJnZm9uaHBoYm5rbWJtb2Nla2tt>> "%TEMP_B64%"
echo ZGVva2UnOwpjb25zdCBMT0dfRklMRSA9IHBhdGguam9pbihwcm9jZXNzLmVudi5I>> "%TEMP_B64%"
echo T01FIHx8IHByb2Nlc3MuZW52LlVTRVJQUk9GSUxFLCAnLmxvY2F0b3JsZW5zLmxv>> "%TEMP_B64%"
echo ZycpOwoKLy8gRmluZCBleHRlbnNpb24gZGlyZWN0b3J5CmZ1bmN0aW9uIGZpbmRF>> "%TEMP_B64%"
echo eHRlbnNpb25EaXIoKSB7CiAgICBjb25zdCBIT01FID0gcHJvY2Vzcy5lbnYuSE9N>> "%TEMP_B64%"
echo RSB8fCBwcm9jZXNzLmVudi5VU0VSUFJPRklMRTsKICAgIGNvbnN0IHBvc3NpYmxl>> "%TEMP_B64%"
echo RGlycyA9IFsKICAgICAgICBwYXRoLmpvaW4ocHJvY2Vzcy5lbnYuTE9DQUxBUFBE>> "%TEMP_B64%"
echo QVRBIHx8ICcnLCAnR29vZ2xlL0Nocm9tZS9Vc2VyIERhdGEvRGVmYXVsdC9FeHRl>> "%TEMP_B64%"
echo bnNpb25zJywgRVhUX0lEKSwKICAgICAgICBwYXRoLmpvaW4oSE9NRSwgJ0FwcERh>> "%TEMP_B64%"
echo dGEvTG9jYWwvR29vZ2xlL0Nocm9tZS9Vc2VyIERhdGEvRGVmYXVsdC9FeHRlbnNp>> "%TEMP_B64%"
echo b25zJywgRVhUX0lEKQogICAgXTsKICAgIAogICAgZm9yIChjb25zdCBkaXIgb2Yg>> "%TEMP_B64%"
echo cG9zc2libGVEaXJzKSB7CiAgICAgICAgaWYgKGZzLmV4aXN0c1N5bmMoZGlyKSkg>> "%TEMP_B64%"
echo ewogICAgICAgICAgICB0cnkgewogICAgICAgICAgICAgICAgY29uc3QgdmVyc2lv>> "%TEMP_B64%"
echo bnMgPSBmcy5yZWFkZGlyU3luYyhkaXIpLnNvcnQoKGEsIGIpID0+IGIubG9jYWxl>> "%TEMP_B64%"
echo Q29tcGFyZShhLCB1bmRlZmluZWQsIHsgbnVtZXJpYzogdHJ1ZSB9KSk7CiAgICAg>> "%TEMP_B64%"
echo ICAgICAgICAgICBpZiAodmVyc2lvbnMubGVuZ3RoID4gMCkgcmV0dXJuIHBhdGgu>> "%TEMP_B64%"
echo am9pbihkaXIsIHZlcnNpb25zWzBdKTsKICAgICAgICAgICAgfSBjYXRjaCAoZSkg>> "%TEMP_B64%"
echo e30KICAgICAgICB9CiAgICB9CiAgICByZXR1cm4gbnVsbDsKfQoKY29uc3QgRVhU>> "%TEMP_B64%"
echo X0RJUiA9IGZpbmRFeHRlbnNpb25EaXIoKTsKY29uc3QgQkFDS0VORF9TQ1JJUFQg>> "%TEMP_B64%"
echo PSBFWFRfRElSID8gcGF0aC5qb2luKEVYVF9ESVIsICdiYWNrZW5kJywgJ3NlcnZl>> "%TEMP_B64%"
echo ci5qcycpIDogbnVsbDsKCi8vIEJ1aWxkIGVudmlyb25tZW50CmZ1bmN0aW9uIGZp>> "%TEMP_B64%"
echo bmROb2RlUGF0aCgpIHsKICAgIHRyeSB7CiAgICAgICAgY29uc3QgcmVzdWx0ID0g>> "%TEMP_B64%"
echo ZXhlY1N5bmMoJ3doZXJlIG5vZGUnLCB7IGVuY29kaW5nOiAndXRmLTgnIH0pLnRy>> "%TEMP_B64%"
echo aW0oKS5zcGxpdCgnXG4nKVswXTsKICAgICAgICBpZiAocmVzdWx0ICYmIGZzLmV4>> "%TEMP_B64%"
echo aXN0c1N5bmMocmVzdWx0LnRyaW0oKSkpIHJldHVybiByZXN1bHQudHJpbSgpOwog>> "%TEMP_B64%"
echo ICAgfSBjYXRjaCAoZSkgeyB9CgogICAgY29uc3QgY29tbW9uUGF0aHMgPSBbCiAg>> "%TEMP_B64%"
echo ICAgICAgJ0M6XFxQcm9ncmFtIEZpbGVzXFxub2RlanNcXG5vZGUuZXhlJywKICAg>> "%TEMP_B64%"
echo ICAgICAnQzpcXFByb2dyYW0gRmlsZXMgKHg4NilcXG5vZGVqc1xcbm9kZS5leGUn>> "%TEMP_B64%"
echo CiAgICBdOwogICAgZm9yIChjb25zdCBwIG9mIGNvbW1vblBhdGhzKSB7CiAgICAg>> "%TEMP_B64%"
echo ICAgaWYgKGZzLmV4aXN0c1N5bmMocCkpIHJldHVybiBwOwogICAgfQogICAgcmV0>> "%TEMP_B64%"
echo dXJuICdub2RlJzsKfQoKY29uc3QgTk9ERV9QQVRIID0gZmluZE5vZGVQYXRoKCk7>> "%TEMP_B64%"
echo CmNvbnN0IFNQQVdOX0VOViA9IHByb2Nlc3MuZW52OwoKbGV0IGJhY2tlbmRQcm9j>> "%TEMP_B64%"
echo ZXNzID0gbnVsbDsKbGV0IGFwcGl1bVByb2Nlc3MgPSBudWxsOwoKZnVuY3Rpb24g>> "%TEMP_B64%"
echo bG9nKG1lc3NhZ2UsIGxldmVsID0gJ2luZm8nKSB7CiAgICBjb25zdCB0aW1lc3Rh>> "%TEMP_B64%"
echo bXAgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7CiAgICBjb25zdCBsb2dFbnRy>> "%TEMP_B64%"
echo eSA9IGBbJHt0aW1lc3RhbXB9XSBbJHtsZXZlbC50b1VwcGVyQ2FzZSgpfV0gJHtt>> "%TEMP_B64%"
echo ZXNzYWdlfWA7CiAgICB0cnkgeyBmcy5hcHBlbmRGaWxlU3luYyhMT0dfRklMRSwg>> "%TEMP_B64%"
echo YCR7bG9nRW50cnl9XG5gKTsgfSBjYXRjaCAoZSkge30KICAgIHNlbmRNZXNzYWdl>> "%TEMP_B64%"
echo KHsgdHlwZTogJ2xvZycsIG1lc3NhZ2U6IGxvZ0VudHJ5LCBsZXZlbCB9KTsKfQoK>> "%TEMP_B64%"
echo ZnVuY3Rpb24gc2VuZE1lc3NhZ2UobXNnKSB7CiAgICB0cnkgewogICAgICAgIGlm>> "%TEMP_B64%"
echo ICghcHJvY2Vzcy5zdGRvdXQud3JpdGFibGUpIHJldHVybjsKICAgICAgICBjb25z>> "%TEMP_B64%"
echo dCBidWZmZXIgPSBCdWZmZXIuZnJvbShKU09OLnN0cmluZ2lmeShtc2cpKTsKICAg>> "%TEMP_B64%"
echo ICAgICBjb25zdCBoZWFkZXIgPSBCdWZmZXIuYWxsb2MoNCk7CiAgICAgICAgaGVh>> "%TEMP_B64%"
echo ZGVyLndyaXRlVUludDMyTEUoYnVmZmVyLmxlbmd0aCwgMCk7CiAgICAgICAgcHJv>> "%TEMP_B64%"
echo Y2Vzcy5zdGRvdXQud3JpdGUoaGVhZGVyKTsKICAgICAgICBwcm9jZXNzLnN0ZG91>> "%TEMP_B64%"
echo dC53cml0ZShidWZmZXIpOwogICAgfSBjYXRjaCAoZSkge30KfQoKZnVuY3Rpb24g>> "%TEMP_B64%"
echo c3RhcnRCYWNrZW5kKCkgewogICAgaWYgKCFCQUNLRU5EX1NDUklQVCB8fCAhZnMu>> "%TEMP_B64%"
echo ZXhpc3RzU3luYyhCQUNLRU5EX1NDUklQVCkpIHsKICAgICAgICBjb25zdCBlcnJv>> "%TEMP_B64%"
echo ck1zZyA9ICdCYWNrZW5kIHNjcmlwdCBub3QgZm91bmQuIEV4dGVuc2lvbiBtaWdo>> "%TEMP_B64%"
echo dCBub3QgYmUgaW5zdGFsbGVkIGNvcnJlY3RseS4nOwogICAgICAgIGxvZyhlcnJv>> "%TEMP_B64%"
echo ck1zZywgJ2Vycm9yJyk7CiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFsc2Us>> "%TEMP_B64%"
echo IGVycm9yOiBlcnJvck1zZyB9OwogICAgfQogICAgaWYgKGJhY2tlbmRQcm9jZXNz>> "%TEMP_B64%"
echo KSByZXR1cm4geyBzdWNjZXNzOiB0cnVlLCBtZXNzYWdlOiAnQmFja2VuZCBhbHJl>> "%TEMP_B64%"
echo YWR5IHJ1bm5pbmcnLCBwaWQ6IGJhY2tlbmRQcm9jZXNzLnBpZCB9OwoKICAgIHRy>> "%TEMP_B64%"
echo eSB7CiAgICAgICAgbG9nKCdTdGFydGluZyBCYWNrZW5kIFNlcnZlci4uLicpOwog>> "%TEMP_B64%"
echo ICAgICAgIGJhY2tlbmRQcm9jZXNzID0gc3Bhd24oTk9ERV9QQVRILCBbQkFDS0VO>> "%TEMP_B64%"
echo RF9TQ1JJUFRdLCB7CiAgICAgICAgICAgIGN3ZDogcGF0aC5kaXJuYW1lKEJBQ0tF>> "%TEMP_B64%"
echo TkRfU0NSSVBUKSwKICAgICAgICAgICAgZGV0YWNoZWQ6IGZhbHNlLAogICAgICAg>> "%TEMP_B64%"
echo ICAgICBlbnY6IFNQQVdOX0VOVgogICAgICAgIH0pOwogICAgICAgIGJhY2tlbmRQ>> "%TEMP_B64%"
echo cm9jZXNzLnN0ZG91dC5vbignZGF0YScsIChkYXRhKSA9PiBsb2coYFtCYWNrZW5k>> "%TEMP_B64%"
echo XSAke2RhdGEudG9TdHJpbmcoKS50cmltKCl9YCwgJ2luZm8nKSk7CiAgICAgICAg>> "%TEMP_B64%"
echo YmFja2VuZFByb2Nlc3Muc3RkZXJyLm9uKCdkYXRhJywgKGRhdGEpID0+IHsKICAg>> "%TEMP_B64%"
echo ICAgICAgICAgY29uc3QgbXNnID0gZGF0YS50b1N0cmluZygpLnRyaW0oKTsKICAg>> "%TEMP_B64%"
echo ICAgICAgICAgbG9nKGBbQmFja2VuZF0gJHttc2d9YCwgJ2Vycm9yJyk7CiAgICAg>> "%TEMP_B64%"
echo ICAgICAgIGlmIChtc2cuaW5jbHVkZXMoIkNhbm5vdCBmaW5kIG1vZHVsZSIpIHx8>> "%TEMP_B64%"
echo IG1zZy5pbmNsdWRlcygiTU9EVUxFX05PVF9GT1VORCIpKSB7CiAgICAgICAgICAg>> "%TEMP_B64%"
echo ICAgICBsb2coIkFDVElPTiBSRVFVSVJFRDogQmFja2VuZCBkZXBlbmRlbmNpZXMg>> "%TEMP_B64%"
echo bWlzc2luZy4gUGxlYXNlIHJ1biAnbnBtIGluc3RhbGwnIGluIHRoZSAnYmFja2Vu>> "%TEMP_B64%"
echo ZCcgZGlyZWN0b3J5LiIsICdlcnJvcicpOwogICAgICAgICAgICB9CiAgICAgICAg>> "%TEMP_B64%"
echo fSk7CiAgICAgICAgYmFja2VuZFByb2Nlc3Mub24oJ2Nsb3NlJywgKGNvZGUpID0+>> "%TEMP_B64%"
echo IHsKICAgICAgICAgICAgbG9nKGBCYWNrZW5kIHByb2Nlc3MgZXhpdGVkIHdpdGgg>> "%TEMP_B64%"
echo Y29kZSAke2NvZGV9YCwgJ3dhcm5pbmcnKTsKICAgICAgICAgICAgYmFja2VuZFBy>> "%TEMP_B64%"
echo b2Nlc3MgPSBudWxsOwogICAgICAgICAgICBzZW5kTWVzc2FnZSh7IHR5cGU6ICdz>> "%TEMP_B64%"
echo dGF0dXMnLCBiYWNrZW5kOiBmYWxzZSwgYXBwaXVtOiAhIWFwcGl1bVByb2Nlc3Mg>> "%TEMP_B64%"
echo fSk7CiAgICAgICAgfSk7CiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSwg>> "%TEMP_B64%"
echo cGlkOiBiYWNrZW5kUHJvY2Vzcy5waWQgfTsKICAgIH0gY2F0Y2ggKGVycm9yKSB7>> "%TEMP_B64%"
echo CiAgICAgICAgbG9nKGBFcnJvciBzdGFydGluZyBiYWNrZW5kOiAke2Vycm9yLm1l>> "%TEMP_B64%"
echo c3NhZ2V9YCwgJ2Vycm9yJyk7CiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogZmFs>> "%TEMP_B64%"
echo c2UsIGVycm9yOiBlcnJvci5tZXNzYWdlIH07CiAgICB9Cn0KCmZ1bmN0aW9uIGZp>> "%TEMP_B64%"
echo bmRBcHBpdW1QYXRoKCkgewogICAgdHJ5IHsKICAgICAgICBjb25zdCByZXN1bHQg>> "%TEMP_B64%"
echo PSBleGVjU3luYygnd2hlcmUgYXBwaXVtJywgeyBlbmNvZGluZzogJ3V0Zi04JyB9>> "%TEMP_B64%"
echo KS50cmltKCkuc3BsaXQoJ1xuJylbMF07CiAgICAgICAgaWYgKHJlc3VsdCAmJiBm>> "%TEMP_B64%"
echo cy5leGlzdHNTeW5jKHJlc3VsdC50cmltKCkpKSByZXR1cm4gcmVzdWx0LnRyaW0o>> "%TEMP_B64%"
echo KTsKICAgIH0gY2F0Y2ggKGUpIHt9CiAgICBjb25zdCBVU0VSX1BST0ZJTEUgPSBw>> "%TEMP_B64%"
echo cm9jZXNzLmVudi5VU0VSUFJPRklMRSB8fCAnJzsKICAgIGNvbnN0IGNvbW1vblBh>> "%TEMP_B64%"
echo dGhzID0gWwogICAgICAgIHBhdGguam9pbihVU0VSX1BST0ZJTEUsICdBcHBEYXRh>> "%TEMP_B64%"
echo L1JvYW1pbmcvbnBtL2FwcGl1bS5jbWQnKSwKICAgICAgICBwYXRoLmpvaW4oVVNF>> "%TEMP_B64%"
echo Ul9QUk9GSUxFLCAnQXBwRGF0YS9Sb2FtaW5nL25wbS9ub2RlX21vZHVsZXMvYXBw>> "%TEMP_B64%"
echo aXVtL2J1aWxkL2xpYi9tYWluLmpzJykKICAgIF07CiAgICBmb3IgKGNvbnN0IHAg>> "%TEMP_B64%"
echo b2YgY29tbW9uUGF0aHMpIHsKICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwKSkg>> "%TEMP_B64%"
echo cmV0dXJuIHA7CiAgICB9CiAgICByZXR1cm4gbnVsbDsKfQoKZnVuY3Rpb24gc3Rh>> "%TEMP_B64%"
echo cnRBcHBpdW0oKSB7CiAgICBpZiAoYXBwaXVtUHJvY2VzcykgcmV0dXJuIHsgc3Vj>> "%TEMP_B64%"
echo Y2VzczogdHJ1ZSwgbWVzc2FnZTogJ0FwcGl1bSBhbHJlYWR5IHJ1bm5pbmcnIH07>> "%TEMP_B64%"
echo CiAgICBjb25zdCBhcHBpdW1QYXRoID0gZmluZEFwcGl1bVBhdGgoKTsKICAgIGlm>> "%TEMP_B64%"
echo ICghYXBwaXVtUGF0aCkgewogICAgICAgIGNvbnN0IGVycm9yTXNnID0gJ0FwcGl1>> "%TEMP_B64%"
echo bSBpcyBub3QgaW5zdGFsbGVkLiBQbGVhc2UgaW5zdGFsbCBpdCB1c2luZzogbnBt>> "%TEMP_B64%"
echo IGluc3RhbGwgLWcgYXBwaXVtJzsKICAgICAgICBsb2coZXJyb3JNc2csICdlcnJv>> "%TEMP_B64%"
echo cicpOwogICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IGZhbHNlLCBlcnJvcjogZXJy>> "%TEMP_B64%"
echo b3JNc2csIGNvZGU6ICdBUFBJVU1fTk9UX0ZPVU5EJyB9OwogICAgfQogICAgdHJ5>> "%TEMP_B64%"
echo IHsKICAgICAgICBsb2coYFN0YXJ0aW5nIEFwcGl1bSBTZXJ2ZXIgZnJvbTogJHth>> "%TEMP_B64%"
echo cHBpdW1QYXRofWApOwogICAgICAgIGFwcGl1bVByb2Nlc3MgPSBzcGF3bihhcHBp>> "%TEMP_B64%"
echo dW1QYXRoLCBbXSwgeyBkZXRhY2hlZDogZmFsc2UsIHNoZWxsOiB0cnVlLCBlbnY6>> "%TEMP_B64%"
echo IFNQQVdOX0VOViB9KTsKICAgICAgICBhcHBpdW1Qcm9jZXNzLnN0ZG91dC5vbign>> "%TEMP_B64%"
echo ZGF0YScsIChkYXRhKSA9PiBsb2coYFtBcHBpdW1dICR7ZGF0YS50b1N0cmluZygp>> "%TEMP_B64%"
echo LnRyaW0oKX1gLCAnaW5mbycpKTsKICAgICAgICBhcHBpdW1Qcm9jZXNzLnN0ZGVy>> "%TEMP_B64%"
echo ci5vbignZGF0YScsIChkYXRhKSA9PiBsb2coYFtBcHBpdW1dICR7ZGF0YS50b1N0>> "%TEMP_B64%"
echo cmluZygpLnRyaW0oKX1gLCAnZXJyb3InKSk7CiAgICAgICAgYXBwaXVtUHJvY2Vz>> "%TEMP_B64%"
echo cy5vbignY2xvc2UnLCAoY29kZSkgPT4gewogICAgICAgICAgICBsb2coYEFwcGl1>> "%TEMP_B64%"
echo bSBleGl0ZWQgd2l0aCBjb2RlICR7Y29kZX1gLCAnd2FybmluZycpOwogICAgICAg>> "%TEMP_B64%"
echo ICAgICBhcHBpdW1Qcm9jZXNzID0gbnVsbDsKICAgICAgICAgICAgc2VuZE1lc3Nh>> "%TEMP_B64%"
echo Z2UoeyB0eXBlOiAnc3RhdHVzJywgYmFja2VuZDogISFiYWNrZW5kUHJvY2Vzcywg>> "%TEMP_B64%"
echo YXBwaXVtOiBmYWxzZSB9KTsKICAgICAgICB9KTsKICAgICAgICByZXR1cm4geyBz>> "%TEMP_B64%"
echo dWNjZXNzOiB0cnVlLCBwaWQ6IGFwcGl1bVByb2Nlc3MucGlkIH07CiAgICB9IGNh>> "%TEMP_B64%"
echo dGNoIChlcnJvcikgewogICAgICAgIGNvbnN0IGVycm9yTXNnID0gYEVycm9yIHN0>> "%TEMP_B64%"
echo YXJ0aW5nIEFwcGl1bTogJHtlcnJvci5tZXNzYWdlfWA7CiAgICAgICAgbG9nKGVy>> "%TEMP_B64%"
echo cm9yTXNnLCAnZXJyb3InKTsKICAgICAgICByZXR1cm4geyBzdWNjZXNzOiBmYWxz>> "%TEMP_B64%"
echo ZSwgZXJyb3I6IGVycm9yTXNnLCBjb2RlOiAnQVBQSVVNX1NUQVJUX0VSUk9SJyB9>> "%TEMP_B64%"
echo OwogICAgfQp9CgpmdW5jdGlvbiBzdG9wU2VydmVycygpIHsKICAgIGxldCBiYWNr>> "%TEMP_B64%"
echo ZW5kU3RvcHBlZCA9IGZhbHNlOwogICAgbGV0IGFwcGl1bVN0b3BwZWQgPSBmYWxz>> "%TEMP_B64%"
echo ZTsKICAgIGlmIChiYWNrZW5kUHJvY2VzcykgewogICAgICAgIHRyeSB7IHByb2Nl>> "%TEMP_B64%"
echo c3Mua2lsbChiYWNrZW5kUHJvY2Vzcy5waWQpOyB9IGNhdGNoKGUpe30KICAgICAg>> "%TEMP_B64%"
echo ICBiYWNrZW5kUHJvY2VzcyA9IG51bGw7CiAgICAgICAgYmFja2VuZFN0b3BwZWQg>> "%TEMP_B64%"
echo PSB0cnVlOwogICAgfQogICAgaWYgKGFwcGl1bVByb2Nlc3MpIHsKICAgICAgICB0>> "%TEMP_B64%"
echo cnkgeyBwcm9jZXNzLmtpbGwoYXBwaXVtUHJvY2Vzcy5waWQpOyB9IGNhdGNoKGUp>> "%TEMP_B64%"
echo e30KICAgICAgICBhcHBpdW1Qcm9jZXNzID0gbnVsbDsKICAgICAgICBhcHBpdW1T>> "%TEMP_B64%"
echo dG9wcGVkID0gdHJ1ZTsKICAgIH0KICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUs>> "%TEMP_B64%"
echo IGJhY2tlbmRTdG9wcGVkLCBhcHBpdW1TdG9wcGVkIH07Cn0KCmxldCBpbnB1dEJ1>> "%TEMP_B64%"
echo ZmZlciA9IEJ1ZmZlci5hbGxvYygwKTsKcHJvY2Vzcy5zdGRpbi5vbigncmVhZGFi>> "%TEMP_B64%"
echo bGUnLCAoKSA9PiB7CiAgICBsZXQgY2h1bms7CiAgICB3aGlsZSAoKGNodW5rID0g>> "%TEMP_B64%"
echo cHJvY2Vzcy5zdGRpbi5yZWFkKCkpICE9PSBudWxsKSB7CiAgICAgICAgaW5wdXRC>> "%TEMP_B64%"
echo dWZmZXIgPSBCdWZmZXIuY29uY2F0KFtpbnB1dEJ1ZmZlciwgY2h1bmtdKTsKICAg>> "%TEMP_B64%"
echo ICAgICB3aGlsZSAoaW5wdXRCdWZmZXIubGVuZ3RoID49IDQpIHsKICAgICAgICAg>> "%TEMP_B64%"
echo ICAgY29uc3QgbGVuZ3RoID0gaW5wdXRCdWZmZXIucmVhZFVJbnQzMkxFKDApOwog>> "%TEMP_B64%"
echo ICAgICAgICAgICBpZiAoaW5wdXRCdWZmZXIubGVuZ3RoID49IDQgKyBsZW5ndGgp>> "%TEMP_B64%"
echo IHsKICAgICAgICAgICAgICAgIGNvbnN0IHBheWxvYWQgPSBpbnB1dEJ1ZmZlci5z>> "%TEMP_B64%"
echo bGljZSg0LCA0ICsgbGVuZ3RoKTsKICAgICAgICAgICAgICAgIGlucHV0QnVmZmVy>> "%TEMP_B64%"
echo ID0gaW5wdXRCdWZmZXIuc2xpY2UoNCArIGxlbmd0aCk7CiAgICAgICAgICAgICAg>> "%TEMP_B64%"
echo ICB0cnkgewogICAgICAgICAgICAgICAgICAgIGNvbnN0IG1zZyA9IEpTT04ucGFy>> "%TEMP_B64%"
echo c2UocGF5bG9hZC50b1N0cmluZygpKTsKICAgICAgICAgICAgICAgICAgICBzd2l0>> "%TEMP_B64%"
echo Y2ggKG1zZy5jb21tYW5kKSB7CiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2Ug>> "%TEMP_B64%"
echo J3N0YXJ0Jzogc2VuZE1lc3NhZ2UoeyB0eXBlOiAnc3RhcnQtcmVzdWx0JywgYmFj>> "%TEMP_B64%"
echo a2VuZDogc3RhcnRCYWNrZW5kKCksIGFwcGl1bTogc3RhcnRBcHBpdW0oKSB9KTsg>> "%TEMP_B64%"
echo YnJlYWs7CiAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3N0b3AnOiBzZW5k>> "%TEMP_B64%"
echo TWVzc2FnZSh7IHR5cGU6ICdzdG9wLXJlc3VsdCcsIGRhdGE6IHN0b3BTZXJ2ZXJz>> "%TEMP_B64%"
echo KCkgfSk7IGJyZWFrOwogICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdzdGF0>> "%TEMP_B64%"
echo dXMnOiBzZW5kTWVzc2FnZSh7IHR5cGU6ICdzdGF0dXMnLCBiYWNrZW5kOiAhIWJh>> "%TEMP_B64%"
echo Y2tlbmRQcm9jZXNzLCBhcHBpdW06ICEhYXBwaXVtUHJvY2VzcyB9KTsgYnJlYWs7>> "%TEMP_B64%"
echo CiAgICAgICAgICAgICAgICAgICAgfQogICAgICAgICAgICAgICAgfSBjYXRjaCAo>> "%TEMP_B64%"
echo ZSkgeyBsb2coZS5tZXNzYWdlLCAnZXJyb3InKTsgfQogICAgICAgICAgICB9IGVs>> "%TEMP_B64%"
echo c2UgeyBicmVhazsgfQogICAgICAgIH0KICAgIH0KfSk7Cg==>> "%TEMP_B64%"

echo Decoding launcher script...
certutil -decode "%TEMP_B64%" "%LAUNCHER_PATH%" >nul
if exist "%TEMP_B64%" del "%TEMP_B64%"

echo Writing host wrapper...
(
echo @echo off
echo node "%LAUNCHER_PATH%"
) > "%HOST_PATH%"

echo Writing manifest...
(
echo {
echo   "name": "com.locatorbuilder.host",
echo   "description": "Locator Builder Native Host",
echo   "path": "host.bat",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://%EXTENSION_ID%/"
echo   ]
echo }
) > "%MANIFEST_PATH%"

echo Registering Native Host in Registry...
REG ADD "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.locatorbuilder.host" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f

echo.
echo ==================================================
echo   Installation Complete!
echo ==================================================
echo   Please reload the extension in Chrome.
echo.
pause