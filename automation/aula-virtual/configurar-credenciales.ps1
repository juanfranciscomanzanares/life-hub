<#
  Ejecuta esto UNA VEZ para guardar tus credenciales cifradas en tu perfil de
  Windows (%APPDATA%\LifeHub\credenciales.xml). Las contraseñas se cifran con
  DPAPI: solo se pueden leer con TU cuenta de Windows, en ESTE ordenador. Si
  alguien copia el archivo a otro PC o inicia sesión con otro usuario, no sirve
  de nada.

  No se sube nada de esto al repositorio de Git.
#>

$carpeta = "$env:APPDATA\LifeHub"
New-Item -ItemType Directory -Force -Path $carpeta | Out-Null

Write-Host "== Credenciales de la UMU (Aula Virtual) ==" -ForegroundColor Cyan
$umuUser = Read-Host "Usuario UMU (email, ej. nombre.apellido@um.es)"
$umuPass = Read-Host "Contraseña UMU" -AsSecureString

Write-Host ""
Write-Host "== Credenciales de Life Hub (Supabase) ==" -ForegroundColor Cyan
Write-Host "La URL y la clave 'anon' las tienes en Vercel -> Settings -> Environment Variables"
$supaUrl = Read-Host "VITE_SUPABASE_URL"
$supaAnon = Read-Host "VITE_SUPABASE_ANON_KEY"
$lhEmail = Read-Host "Tu email de Life Hub"
$lhPass = Read-Host "Tu contraseña de Life Hub" -AsSecureString

$obj = [PSCustomObject]@{
    UmuUser  = $umuUser
    UmuPass  = $umuPass
    SupaUrl  = $supaUrl
    SupaAnon = $supaAnon
    LhEmail  = $lhEmail
    LhPass   = $lhPass
}

$destino = "$carpeta\credenciales.xml"
$obj | Export-Clixml -Path $destino
Write-Host ""
Write-Host "Guardado en $destino" -ForegroundColor Green
Write-Host "Ahora ejecuta: .\ejecutar-login-inicial.ps1"
