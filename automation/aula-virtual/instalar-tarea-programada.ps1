<#
  Registra una tarea programada de Windows que ejecuta ejecutar-sync.ps1 cada
  día a las 08:00 (ajusta $Hora si quieres otra). Se ejecuta con TU usuario,
  así que solo funciona mientras tengas sesión iniciada en Windows (no hace
  falta la app abierta ni el ordenador desbloqueado) — es lo más simple que
  funciona con el cifrado DPAPI de las credenciales.

  Si el ordenador está apagado a las 08:00, la tarea se lanza en cuanto
  vuelvas a iniciar sesión (gracias a -MultipleInstances / StartWhenAvailable).
#>

$Hora = "08:00"
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $aqui "ejecutar-sync.ps1"

$accion = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""

$trigger = New-ScheduledTaskTrigger -Daily -At $Hora

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

Register-ScheduledTask -TaskName "LifeHub - Sync Aula Virtual" `
    -Action $accion -Trigger $trigger -Settings $settings `
    -Description "Sincroniza las tareas del Aula Virtual UMU con Life Hub, una vez al día." `
    -Force

Write-Host "Tarea programada creada: se ejecutará cada día a las $Hora." -ForegroundColor Green
Write-Host "Puedes verla/editarla en el Programador de tareas de Windows, carpeta raíz, nombre 'LifeHub - Sync Aula Virtual'."
