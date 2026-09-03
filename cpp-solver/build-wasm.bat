@echo off
setlocal
set EMSDK=C:\Users\LENOVO\Desktop\Codex projects\Game Develop\_tools\emsdk
call "%EMSDK%\emsdk_env.bat"
em++ golden_solver.cpp -O3 -std=c++17 -s WASM=1 -s MODULARIZE=1 -s EXPORT_NAME=GoldenScapegoatSolver -s ENVIRONMENT=web -s INITIAL_MEMORY=67108864 -s ALLOW_MEMORY_GROWTH=1 -s MAXIMUM_MEMORY=268435456 -s EXPORTED_FUNCTIONS="['_golden_hint']" -s EXPORTED_RUNTIME_METHODS="['cwrap']" -o golden-solver.js
endlocal
