<#
  Este es el que llama el Programador de tareas de Windows cada día.
  No pide nada: si la sesión guardada sigue siendo válida, sincroniza sola.
#>
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $aqui

. .\_comun.ps1

node sync.mjs
