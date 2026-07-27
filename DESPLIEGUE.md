# Desplegar Life Hub y usarlo en tu iPhone

Guía paso a paso, de cero a tenerlo funcionando en el móvil. Tiempo estimado: 30–45 min.

Hay dos niveles:
- **Básico**: la app en internet, con tus datos guardados en cada dispositivo (sin sincronizar).
- **Con nube**: además, sincronización entre PC y iPhone, login por email y bloqueo. (Recomendado.)

---

## Parte 1 · Probar en tu ordenador (5 min)

1. Instala **Node.js LTS** desde https://nodejs.org
2. Abre una terminal en la carpeta `life-hub` y ejecuta:
   ```bash
   npm install
   npm run dev
   ```
3. Abre la URL que aparece (http://localhost:5173). Ya funciona (datos en tu navegador).
4. Para lanzar los tests: `npm test`.

---

## Parte 2 · Subirlo a internet con GitHub + Vercel (15 min)

### 2.1 Crear el repositorio en GitHub
1. Crea una cuenta en https://github.com si no tienes.
2. Instala **Git** (https://git-scm.com) si no lo tienes.
3. En la carpeta `life-hub`, en la terminal:
   ```bash
   git init
   git add .
   git commit -m "Life Hub"
   ```
4. En GitHub, crea un repositorio nuevo (vacío, sin README) llamado `life-hub`.
5. Conecta y sube (cambia TU-USUARIO):
   ```bash
   git remote add origin https://github.com/TU-USUARIO/life-hub.git
   git branch -M main
   git push -u origin main
   ```

> El archivo `.gitignore` ya evita subir `node_modules` y tu `.env` (tus claves NO se suben).

### 2.2 Desplegar en Vercel
1. Entra en https://vercel.com y regístrate con tu cuenta de GitHub.
2. **Add New… → Project** y elige el repo `life-hub`.
3. Vercel detecta Vite automáticamente (Build: `vite build`, Output: `dist`). Pulsa **Deploy**.
4. En 1–2 minutos tendrás una URL pública, p. ej. `https://life-hub-tuusuario.vercel.app`.

Cada vez que hagas `git push`, Vercel vuelve a desplegar solo.

---

## Parte 3 · Instalarlo en el iPhone (2 min)

1. Abre tu URL de Vercel en **Safari** (en el iPhone).
2. Toca el botón **Compartir** (cuadro con flecha).
3. **Añadir a pantalla de inicio** → Añadir.
4. Aparecerá el icono de Life Hub como una app. Ábrela: va a pantalla completa y funciona sin conexión.

---

## Parte 4 · Activar la nube (Supabase) — sincronización PC + iPhone (15 min)

Sin esto cada dispositivo guarda lo suyo. Con esto, compartes datos y tienes login + bloqueo.

1. Crea una cuenta gratis en https://supabase.com y un **proyecto nuevo** (elige región Europa).
2. Ve a **SQL Editor → New query**, pega TODO el contenido de `supabase-schema.sql`
   (incluido en el proyecto) y pulsa **Run**. Esto crea la tabla, el tiempo real y el bucket de adjuntos.
3. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key**
4. En Vercel: **Project → Settings → Environment Variables**, añade:
   - `VITE_SUPABASE_URL` = tu Project URL
   - `VITE_SUPABASE_ANON_KEY` = tu anon key
5. Ve a **Deployments** en Vercel y pulsa **Redeploy** para que tome las variables.
6. Abre la app: ahora te pedirá tu **email**; recibirás un enlace de acceso. Al entrar en el PC
   y en el iPhone con el mismo email, verás los mismos datos, sincronizados al instante.

> Para probar la nube en local, copia `.env.example` como `.env`, pon ahí las dos variables y
> reinicia `npm run dev`.

---

## Parte 5 · Extras opcionales (cuando quieras)

Todo esto está documentado en `docs/INTEGRACIONES.md`:
- **Precios de acciones/ETF**: desplegar la función `supabase/functions/stock-price` y poner
  `VITE_FUNCTIONS_URL` en Vercel.
- **Leer el banco** (GoCardless), **resumen por email** (`weekly-summary`), **notificaciones push**.
- **Datos del reloj** (Apple Watch vía Atajos, o Fitbit/Garmin).

---

## Resolución de problemas

### En el móvil se queda la pantalla en negro y no puedo entrar

Es el fallo más común de una PWA. Va por orden, de más probable a menos:

1. **Caché vieja del service worker.** El móvil se quedó con una versión antigua de la
   app que apunta a archivos que ya no existen en el servidor. Solución:
   - Si la tenías **añadida a la pantalla de inicio**, bórrala (mantener pulsado → Eliminar app).
   - En Safari: **Ajustes → Safari → Borrar historial y datos de sitios web**.
   - Vuelve a abrir la URL de Vercel y añádela de nuevo a la pantalla de inicio.
   - En la pantalla de carga/login hay ahora un enlace **"Reiniciar app (borra caché)"**
     que hace esto mismo sin perder tus datos.

2. **Redirect URLs de Supabase.** En Supabase → **Authentication → URL Configuration**:
   - **Site URL** = tu URL de Vercel (p. ej. `https://life-hub-tuusuario.vercel.app`),
     **sin barra final**.
   - **Redirect URLs** debe incluir esa misma URL y `https://tu-app.vercel.app/**`.
     Si la URL a la que vuelve el enlace no está en esta lista, Supabase te manda al
     Site URL por defecto (`http://localhost:3000`), que en el móvil no existe.

3. **El enlace se abre en el navegador de Gmail, no en Safari.** El enlace mágico es de
   **un solo uso**. Si la app de correo lo pre-carga o lo abre en su navegador interno, la
   sesión se crea "en otro sitio". Solución: **mantén pulsado el enlace → Copiar**, y pégalo
   en la barra de Safari (o en el navegador donde pediste el acceso).

4. **El email dice "confirma tu registro" en vez de "inicia sesión".** Significa que ese
   correo aún no está confirmado en Supabase. Míralo en **Authentication → Users**: si el
   usuario aparece sin confirmar, pulsa los tres puntos → **Confirm user**, o borra el
   usuario y vuelve a pedir el enlace.

5. **Límite de emails.** El servidor SMTP gratuito de Supabase permite muy pocos correos
   por hora. Si has pedido muchos enlaces seguidos, espera un rato o configura tu propio
   SMTP en **Authentication → Emails → SMTP Settings**.

- **La app carga en blanco tras añadir Supabase**: revisa que las dos variables estén bien escritas
  en Vercel y que hiciste Redeploy.
- **No llega el email de acceso**: mira spam; en Supabase, Authentication → Providers → Email debe
  estar activado.
- **Los adjuntos no suben en la nube**: asegúrate de haber ejecutado el `supabase-schema.sql`
  completo (crea el bucket `adjuntos`).
- **Quiero volver a datos de ejemplo**: en Datos → puedes restaurar copias o, en el navegador,
  borrar los datos del sitio.
