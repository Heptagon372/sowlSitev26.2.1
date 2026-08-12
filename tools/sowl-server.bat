@echo off
title S.OWL DEV SERVER
chcp 65001 >nul
cd /d "%~dp0.."
node tools\launcher.mjs --open
if errorlevel 1 pause
