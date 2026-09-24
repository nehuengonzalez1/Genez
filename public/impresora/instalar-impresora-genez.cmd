@echo off
rem ============================================================
rem  GENEZ - instalar la impresion directa
rem ============================================================
rem  Baja el programa de impresion de genez.com.ar, lo deja en la carpeta
rem  del usuario, lo agrega al inicio de Windows y lo arranca. No pide
rem  permisos de administrador. Para sacarlo: desinstalar-impresora-genez.cmd
rem ============================================================

set "DEST=%LOCALAPPDATA%\GenezImpresora"
set "ORIGEN=https://genez.com.ar/impresora/genez-impresora.ps1"

echo.
echo  Instalando la impresion directa de Genez...
echo.

if not exist "%DEST%" mkdir "%DEST%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri '%ORIGEN%' -OutFile '%DEST%\genez-impresora.ps1' } catch { Write-Host ('  No se pudo bajar el programa: ' + $_.Exception.Message); exit 1 }"
if errorlevel 1 goto fallo

rem Arranca solo con Windows: un acceso directo en la carpeta Inicio del usuario.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$a = (New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup') + '\Genez Impresora.lnk'); $a.TargetPath = 'powershell.exe'; $a.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File \"%DEST%\genez-impresora.ps1\"'; $a.WindowStyle = 7; $a.Description = 'Genez - impresion directa de tickets'; $a.Save()"
if errorlevel 1 goto fallo

rem Si ya habia uno andando (una version vieja), se corta para que arranque el nuevo.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*genez-impresora.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

start "" powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%DEST%\genez-impresora.ps1"

echo  Listo. La impresion directa de Genez quedo instalada y va a arrancar
echo  sola cada vez que se prenda la computadora.
echo.
echo  Ahora, en Genez: Ajustes, "Impresion directa", elegi la impresora
echo  termica y apreta "Imprimir prueba".
echo.
pause
exit /b 0

:fallo
echo.
echo  No se pudo instalar. Revisa que haya internet y proba de nuevo.
echo.
pause
exit /b 1
