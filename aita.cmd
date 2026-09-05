@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo [AITA] Node.js 20 or newer is required only for the optional maintenance CLI.
  echo [AITA] The website itself works by double-clicking index.html.
  exit /b 1
)
node "%~dp0tools\aita.mjs" %*
exit /b %errorlevel%
