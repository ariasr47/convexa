@echo off
rem Spire bridge shim (shim-cmd), Direct-v4 target 4.0.0, generation gen-74f7daa49278df06.
node "%~dp0spire.mjs" %*
exit /b %ERRORLEVEL%
