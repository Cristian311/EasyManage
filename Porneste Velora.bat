@echo off
rem Porneste Velora Stay cu un dublu-click: MySQL (din XAMPP), programul si browserul.
rem Fereastra neagra trebuie sa ramana deschisa cat lucrezi; o inchizi cand ai terminat.
title Velora Stay
chcp 65001 >nul
set "PATH=C:\nvm4w\nodejs;%PATH%"
cd /d "%~dp0web"

where node >nul 2>&1
if errorlevel 1 (
  echo Nu gasesc Node.js. Instaleaza-l de pe https://nodejs.org si incearca din nou.
  pause & exit /b 1
)

rem --- MySQL: daca nu raspunde pe 3306, il pornesc din XAMPP
netstat -ano | findstr /r /c:":3306 .*LISTENING" >nul
if errorlevel 1 (
  if exist "C:\xampp\mysql\bin\mysqld.exe" (
    echo Pornesc MySQL...
    start "" /min "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone
    timeout /t 5 /nobreak >nul
  ) else (
    echo Nu gasesc MySQL in C:\xampp. Porneste-l din XAMPP Control Panel si incearca din nou.
    pause & exit /b 1
  )
)

rem --- daca programul merge deja, doar deschid browserul
netstat -ano | findstr /r /c:":3000 .*LISTENING" >nul
if not errorlevel 1 (
  start "" http://localhost:3000
  exit /b 0
)

if not exist node_modules (
  echo Prima pornire: descarc pachetele, dureaza un minut...
  call npm install || (pause & exit /b 1)
)
if not exist ".next\BUILD_ID" (
  echo Pregatesc programul, dureaza un minut...
  call npm run build || (pause & exit /b 1)
)

echo.
echo Velora Stay porneste. Lasa fereastra aceasta deschisa.
echo De pe telefon, in aceeasi retea Wi-Fi: http://IP-ul-calculatorului:3000
echo.
start "" /min cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"
call npx next start -H 0.0.0.0 -p 3000
pause
