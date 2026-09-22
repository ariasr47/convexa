@echo off
rem Spire bridge shim (shim-cmd), Direct-v4 target 4.2.0, generation gen-344efe06b2d76427.
node "%~dp0spire.mjs" %*
exit /b %ERRORLEVEL%
