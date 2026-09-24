@echo off
setlocal
cd /d "%~dp0"

echo Starting ETL AI System...

REM Clear stale processes that may still hold ports 3000 or 5000 from a previous run.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000,5000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo [1/3] Starting Backend...
start "Backend" cmd /k "cd /d \"%~dp0backend\" && set AIRFLOW_ENABLED=false && npm start"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Frontend...
start "Frontend" cmd /k "cd /d \"%~dp0frontend\" && npm install && npm run dev"

echo [3/3] Starting AI Service (optional)...
start "AI Service" cmd /k "cd /d \"%~dp0ai-service\" && python app.py"

echo.
echo ==========================================
echo  ETL AI System Started!
echo  Frontend: http://localhost:3000
echo  Backend:  http://localhost:5000
echo  AI:       http://localhost:8000
echo ==========================================
echo  Login: admin@etl.com / admin123
echo ==========================================
endlocal
