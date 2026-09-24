@echo off
setlocal
where bash.exe >nul 2>nul
if errorlevel 1 (
  echo Git Bash was not found. Install Git for Windows first. 1>&2
  exit /b 1
)
bash.exe "%~dp0dsh-git-bash.sh" %*
