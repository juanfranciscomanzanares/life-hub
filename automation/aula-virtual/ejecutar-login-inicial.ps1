<#
  Ejecuta esto tú mismo, UNA VEZ (y cada vez que sync.mjs avise de que la
  sesión caducó). Abre un navegador de verdad y te pide el código de 2FA en
  esta misma ventana.
#>
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $aqui

. .\_comun.ps1

if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias (npm install)..." -ForegroundColor Yellow
    npm install
}

node login-inicial.mjs
