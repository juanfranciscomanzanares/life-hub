<#
  Cargado por ejecutar-login-inicial.ps1 y ejecutar-sync.ps1: descifra
  credenciales.xml y las deja como variables de entorno para el proceso hijo
  de Node (nunca se escriben en disco en plano).
#>

$ruta = "$env:APPDATA\LifeHub\credenciales.xml"
if (-not (Test-Path $ruta)) {
    Write-Error "No hay credenciales guardadas. Ejecuta primero: .\configurar-credenciales.ps1"
    exit 1
}

$creds = Import-Clixml -Path $ruta

function ConvertFrom-Secura($secureString) {
    [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureString)
    )
}

$env:UMU_USER = $creds.UmuUser
$env:UMU_PASS = ConvertFrom-Secura $creds.UmuPass
$env:SUPABASE_URL = $creds.SupaUrl
$env:SUPABASE_ANON_KEY = $creds.SupaAnon
$env:LH_EMAIL = $creds.LhEmail
$env:LH_PASSWORD = ConvertFrom-Secura $creds.LhPass
