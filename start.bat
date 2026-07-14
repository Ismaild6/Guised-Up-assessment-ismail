@echo off
echo Starting Guised Up...

start "Embedding" cmd /k "cd /d %~dp0embedding-service && python main.py"
timeout /t 2 /nobreak >nul

cd /d %~dp0server
if not exist guisedup.sqlite node seed.js
start "API" cmd /k "node index.js"
timeout /t 2 /nobreak >nul

cd /d %~dp0mobile
start "Mobile" cmd /k "npx expo start --web"

echo.
echo Open in browser: http://localhost:8081
echo API: http://localhost:8000
echo Login: dev@guisedup.test / password
