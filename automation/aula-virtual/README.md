# Sincronización automática con el Aula Virtual UMU

Esto vive fuera de la app web (Vite) a propósito: necesita un navegador de
verdad (Playwright/Chromium) para pasar el login CAS + 2FA de la UMU, cosa que
una Edge Function no puede hacer. Corre en tu PC, programado con el
Programador de tareas de Windows.

## Por qué hace falta esto y no una función en la nube

- El login directo de Sakai y el HTTP Basic están desactivados en la UMU.
- El login real es CAS, con un formulario que solo existe tras ejecutar
  JavaScript (no se puede rellenar con `curl`/`fetch`).
- Además pide un segundo factor (SMS, llamada, email o app OTP).

La única vía que funciona: un navegador real hace el login una vez (con el
2FA que toque) y acepta "Registro de dispositivo de confianza". A partir de
ahí, ese navegador (identificado por sus cookies) puede volver a entrar sin
2FA durante un tiempo. Por eso hay dos scripts:

- **`login-inicial.mjs`** — lo ejecutas tú, a mano, de vez en cuando (la
  primera vez, y cada vez que la sesión caduque). Te pide el código de 2FA
  en la propia terminal.
- **`sync.mjs`** — lo ejecuta el Programador de tareas cada día, sin pedir
  nada. Si la sesión ya no vale, lo deja escrito en el log y no hace nada más
  (no puede inventarse un 2FA).

## Instalación (una vez)

En PowerShell, dentro de esta carpeta:

```powershell
.\configurar-credenciales.ps1    # te pide tus credenciales, las cifra con DPAPI
.\ejecutar-login-inicial.ps1     # login real con 2FA, una vez
.\instalar-tarea-programada.ps1  # programa sync.mjs a diario
```

## Dónde queda cada cosa

- `%APPDATA%\LifeHub\credenciales.xml` — tus credenciales, cifradas con
  DPAPI (solo legibles con tu cuenta de Windows en este PC). No está en Git.
- `%APPDATA%\LifeHub\aula-sesion.json` — la cookie de sesión/dispositivo de
  confianza. Tampoco está en Git.
- `%APPDATA%\LifeHub\aula-sync.log` — registro de cada sincronización, para
  saber si algo falló.

## Cuando deje de funcionar

La UMU caduca el "dispositivo de confianza" pasado un tiempo (semanas o
meses, no lo dice explícitamente). Cuando pase, `sync.mjs` lo detecta y lo
escribe en el log en vez de fallar en silencio. Basta con volver a ejecutar
`.\ejecutar-login-inicial.ps1` una vez.
