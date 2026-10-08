@echo off
rem Spire bridge shim (shim-cmd), Direct-v4 target 4.8.0, generation gen-e04559a83188e6e6.
node "%~dp0spire.mjs" %*
exit /b %ERRORLEVEL%
