# Life Hub

Panel personal (dashboard) para gestionar tu vida: trabajo, universidad, deporte,
finanzas, inversiones, hábitos y una base de conocimiento. React + Tailwind, modo
oscuro, con sincronización opcional en la nube (Supabase) para tener los mismos
datos en el ordenador y en el iPhone.

## Secciones

- **Inicio** — resumen del día, tareas urgentes y horas por actividad.
- **Trabajo · Agrosana** — registro de tiempo por actividad/categoría, analítica
  mensual con comparación entre meses, y base de "cómo lo hice" (procedimientos).
- **Gimnasio** — tabla de marcas con catálogo de ejercicios por grupo muscular.
- **Universidad** — horario, tareas filtrables por asignatura y horas de estudio.
- **Tenis de Mesa** — horas semanales, ejercicios técnicos y notas.
- **Finanzas** — ingresos/gastos, presupuesto mensual y objetivo de ahorro.
- **Inversiones** — cartera con rentabilidad por activo, aportaciones desde el
  sueldo (con registro) y objetivo mensual de inversión.
- **Hábitos** — seguimiento semanal con rachas.
- **Segundo Cerebro** — notas, enlaces y flashcards buscables.
- **Metas** — objetivos con progreso, KPIs automáticos de otras secciones y
  gráfico de evolución de la cartera mes a mes.
- **Calendario** — vista mensual que junta gym, trabajo, finanzas, aportaciones
  y tus propios eventos.
- **Datos** — exportar a Excel (CSV), copia de seguridad completa (JSON) y
  recordatorios con notificaciones del navegador.
- **Salud** — peso, sueño, pasos, frecuencia cardíaca y agua, con evolución del
  peso. Campos listos para recibir datos de un smartwatch (ver docs/INTEGRACIONES.md).
- **Resumen semanal** — recuento automático de tu semana (trabajo, gym, ahorro,
  sueño, hábitos) con opción de notificación.

La sección **Inversiones** puede actualizar el valor de los activos **cripto** con
precios reales de CoinGecko (marca el tipo "Cripto", pon el id y la cantidad).

Robustez y coaching: **Coach** con sugerencias según tus datos, **puntos de
restauración** (papelera/máquina del tiempo en Datos), **resolución de conflictos**
por marca de tiempo al sincronizar, **tests** con Vitest (`npm test`), **paginación**
en tablas largas y **etiquetas editables** desde el añadido rápido. También hay
Edge Functions de ejemplo para **resumen por email** (`weekly-summary`) y handlers
de **push** en el service worker (ver docs/INTEGRACIONES.md).

Infraestructura reciente: **sincronización en tiempo real** entre dispositivos
(Supabase Realtime), **copia de seguridad cifrada** con contraseña (AES-GCM),
**Adjuntos** (fotos/apuntes, con Supabase Storage o local), **Etiquetas** que
agrupan lo etiquetado de varias secciones, y **precios de acciones/ETF** vía Edge
Function (`supabase/functions/stock-price/`, además de la cripto por CoinGecko).

Novedades de productividad: **búsqueda global** (Ctrl/Cmd + K), **botón + flotante**
para añadir rápido desde cualquier pantalla, **modo foco/Pomodoro** que registra
horas, **Logros** (gamificación), **Analítica anual** con comparativas y patrones,
**Repaso** espaciado de flashcards, **tema claro/oscuro**, **onboarding** inicial y
**copias de seguridad automáticas**.

Otras funciones: en **Inicio** verás tu rutina de **hoy**; el **Gimnasio** guarda
una nota por sesión y dibuja tu **progreso de peso por ejercicio**; el
**Calendario** avisa con una notificación antes de cada actividad de tu rutina;
en **Datos** puedes generar un **informe mensual en PDF** y activar un **bloqueo**
de la app con **PIN + Face ID / huella** (biometría por WebAuthn).

## PWA: instalar como app

La app es una PWA: en el iPhone, ábrela en Safari y usa **Compartir → Añadir a
pantalla de inicio**. Se instala como app, funciona a pantalla completa y carga
sin conexión (service worker). En Android/Chrome saldrá el aviso de "Instalar app".

## Integraciones (banco, reloj, precios, resumen automático)

Ver **docs/INTEGRACIONES.md** para conectar el banco (GoCardless), datos del reloj
(HealthKit/Shortcuts, Fitbit, Garmin), precios de acciones y el envío automático
del resumen semanal. La función de servidor de ejemplo está en
`supabase/functions/bank-sync/`.

---

## 1. Requisitos

Instala **Node.js 18 o superior** desde https://nodejs.org (versión LTS).

## 2. Poner en marcha en el ordenador

Abre una terminal en la carpeta `life-hub` y ejecuta:

```bash
npm install
npm run dev
```

Verás una URL tipo `http://localhost:5173`. Ábrela en el navegador.
Sin configurar nada más, la app funciona guardando los datos **en ese navegador**.

## 3. Verlo en el iPhone (opción rápida, misma WiFi)

Con `npm run dev` en marcha, la terminal muestra también una dirección **Network**
(algo como `http://192.168.1.40:5173`). Con el iPhone conectado a la **misma WiFi**,
abre esa dirección en Safari. Nota: esto solo funciona con el ordenador encendido.

## 4. Publicarlo en internet (recomendado para el móvil)

Así lo tienes siempre disponible en el iPhone, sin depender del ordenador.

1. Sube la carpeta `life-hub` a un repositorio de **GitHub**.
2. Entra en https://vercel.com, "Add New Project", elige el repo. Vercel detecta
   Vite automáticamente. Pulsa **Deploy**.
3. Te da una URL pública, p. ej. `https://life-hub-tuusuario.vercel.app`.
4. En el iPhone abre esa URL en Safari → botón **Compartir** → **Añadir a pantalla
   de inicio**. Queda como una app a pantalla completa.

(Netlify funciona igual de bien si lo prefieres.)

---

## 5. Activar la nube (Supabase) — datos sincronizados PC + móvil

Sin esto, cada dispositivo guarda sus propios datos. Con esto, los compartes.

1. Crea una cuenta gratis en https://supabase.com y un proyecto nuevo.
2. En el panel de Supabase, ve a **SQL Editor → New query**, pega el contenido de
   `supabase-schema.sql` (incluido en este proyecto) y pulsa **Run**.
3. Ve a **Authentication → Providers** y asegúrate de que **Email** está activado
   (viene activado por defecto; usa enlace mágico, sin contraseña).
4. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key**
5. En la carpeta `life-hub`, copia el archivo `.env.example` como `.env` y pega
   esos dos valores:

   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-anon
   ```

6. Reinicia `npm run dev`. Ahora la app pedirá tu email al entrar: recibirás un
   enlace de acceso y, al iniciar sesión, tus datos se guardan en la nube.
7. Si lo despliegas en Vercel, añade esas mismas dos variables en
   **Vercel → Project → Settings → Environment Variables** y vuelve a desplegar.

### ¿Cuánto duran los datos?

- **Modo local** (sin Supabase): los datos se guardan en el navegador y duran
  indefinidamente, hasta que borres los datos de navegación de ese navegador.
  No se comparten entre dispositivos.
- **Modo nube** (con Supabase): los datos viven en tu base de datos y persisten
  siempre. Puedes entrar desde el PC o el iPhone y ver lo mismo. La analítica
  mensual (Trabajo e Inversiones) se calcula a partir de ese histórico.

---

## Estructura del proyecto

```
life-hub/
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js
├─ postcss.config.js
├─ .env.example            → cópialo como .env
├─ supabase-schema.sql     → pégalo en el SQL Editor de Supabase
└─ src/
   ├─ main.jsx
   ├─ App.jsx              → login por email + carga del dashboard
   ├─ index.css
   ├─ LifeDashboard.jsx    → todas las secciones
   └─ lib/
      ├─ supabase.js       → cliente de Supabase
      └─ store.js          → capa de datos (nube + navegador)
```
