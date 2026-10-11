@echo off
setlocal
node "%~dp0scripts\serve.mjs"
if errorlevel 1 pause
