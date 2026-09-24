@echo off
rem GENEZ - sacar la impresion directa de esta computadora.
echo.
echo  Sacando la impresion directa de Genez...
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*genez-impresora.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1
del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\Genez Impresora.lnk" 2>nul
rmdir /s /q "%LOCALAPPDATA%\GenezImpresora" 2>nul
echo  Listo. Genez vuelve a imprimir con la ventana del navegador.
echo.
pause
