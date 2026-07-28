# Integraciones (tenis de mesa, banco, reloj, precios, resumen automático)

Este documento explica qué integraciones son posibles, cuáles funcionan solo
desde el navegador y cuáles necesitan un pequeño servidor (Supabase Edge Functions).

> Regla de oro de seguridad: cualquier **clave secreta** (banco, brókers, APIs de
> pago) NO puede ir en el código del navegador, porque sería pública. Va siempre
> en el servidor (Edge Function con variables de entorno).

---

## 0. Tenis de mesa: liga RFETM y opens FTMRM

La sección **Tenis de Mesa** descarga sola tus partidos de la liga nacional y tus
puestos en los opens regionales. Todo son páginas y PDFs públicos: no hace falta
ninguna cuenta ni credencial.

### Desplegar la función

```bash
supabase functions deploy tenis-mesa
```

No necesita secretos. Es un puente: descarga la URL que se le pide y, si es un
PDF, devuelve su texto extraído. Va con **lista blanca de dominios** (ftmrm.es,
rfetm.es, clubs.rfetm.es, drive.google.com); sin ella sería un proxy abierto que
cualquiera podría usar para pedir cualquier cosa desde tu proyecto.

Hace falta un servidor porque esas webs no envían cabeceras CORS y el navegador
no puede descargarlas directamente. La función **no interpreta** los datos: solo
devuelve texto. Todo el parseo vive en `src/lib/tenis.js`, cubierto por tests con
actas reales; si estuviera en la función habría que duplicarlo o dejarlo sin probar.

### Configurar

En la app, **Tenis de Mesa → Ajustes**:

- **Nº de licencia**: aparece entre paréntesis junto a tu nombre en las actas.
  Se filtra por licencia y no por nombre porque los nombres llegan con acentos y
  mayúsculas inconsistentes ("MARTíNEZ").
- **Nombre**: solo para los rankings de opens, que no llevan licencia. Con el
  apellido basta.
- **División y grupo**: los de tu equipo.
- **Id de equipo** (opcional pero muy recomendable): con él se bajan solo las
  ~20 actas de tu club en vez de las 110 del grupo. Lo sacas del enlace de tu
  equipo en la web de la RFETM, en el parámetro `&equipo=`.

### Cómo funciona

- **Incremental**: las actas ya descargadas no se vuelven a pedir, así que
  sincronizar a mitad de temporada cuesta una o dos actas.
- **Por temporada**: cada partido guarda la suya, leída del propio acta. Para
  una temporada nueva basta con cambiarla en Ajustes.
- **Trampa del formato**: en el acta, ABC/XYZ **no** equivale a local/visitante.
  Hay jornadas en las que el equipo local aparece como XYZ. Lo que manda es la
  letra del jugador (A/B/C o X/Y/Z). Guiarse por "Equipo Local" invertiría todos
  los resultados.
- Los **dobles** no se cuentan todavía: en el acta ocupan varias líneas con dos
  jugadores por lado y necesitan otro tratamiento. La app indica cuántos ha visto.

---

## 1. Leer tu banco (open banking / PSD2) — GoCardless Bank Account Data

Permite **leer** tus movimientos y saldos (no mover dinero). Gratis para uso
personal. Flujo:

1. Crea una cuenta en https://bankaccountdata.gocardless.com y consigue
   `SECRET_ID` y `SECRET_KEY`.
2. Despliega la Edge Function `supabase/functions/bank-sync` (ver código incluido).
   Guarda las credenciales como secretos:
   ```bash
   supabase secrets set GC_SECRET_ID=xxx GC_SECRET_KEY=yyy
   supabase functions deploy bank-sync
   ```
3. El flujo real de GoCardless tiene 3 pasos: crear token → crear "requisition"
   (el usuario autoriza en la web de su banco) → leer transacciones. La función
   incluida muestra la estructura; añade el paso de autorización la primera vez.
4. La app llama a la función, recibe los movimientos y los vuelca en la sección
   **Finanzas** (clave `lh_finance`).

**Importante:** invertir de verdad o pagar con tarjeta desde la app NO es posible
sin ser una entidad regulada. Un bróker con API (p. ej. Interactive Brokers) sí
permite ver tu cartera y operar a través de SU infraestructura, nunca cobrando a
una tarjeta desde esta app.

---

## 2. Datos del reloj / smartwatch

- **Apple Watch:** los datos van a la app **Salud (HealthKit)** del iPhone. Una web
  no puede leer HealthKit directamente. Dos caminos:
  - **Atajos (Shortcuts) → Supabase (rápido, sin programar app):** crea un atajo
    "Obtener datos de salud" → "Obtener contenido de URL" (POST) a una Edge
    Function que guarde el dato en `lh_health`. Puedes automatizarlo cada noche.
  - **App nativa SwiftUI + HealthKit:** pide permiso a HealthKit y envía a Supabase.
    Más trabajo, pero acceso total (sueño, FC, VO2, etc.).
- **Fitbit / Garmin / Wear OS:** tienen **API web con OAuth**. Desde una Edge
  Function te conectas y te traes actividad, sueño y pulso automáticamente. Es la
  vía más sencilla si no quieres depender de Apple.

La sección **Salud** ya tiene los campos (peso, sueño, pasos, FC, agua) listos
para recibir estos datos.

---

## 3. Precios reales de inversiones

- **Cripto:** ya funciona desde el navegador con **CoinGecko** (gratis, sin clave).
  En Inversiones, marca el activo como "Cripto", pon su `id` de CoinGecko
  (bitcoin, ethereum, solana...) y la cantidad, y pulsa "Actualizar precios".
- **Acciones / ETF / fondos:** necesitan una API con clave (Finnhub,
  Alpha Vantage, Twelve Data). Como la clave es secreta, la llamada se hace desde
  una Edge Function, igual que el banco.

---

## 4. Resumen semanal automático (cada domingo)

La sección **Resumen** lo calcula en el momento. Para recibirlo **automáticamente**
(notificación push o email) sin abrir la app:

1. Crea una Edge Function que calcule el resumen y envíe un email (con Resend o
   el SMTP que prefieras) o una notificación push (Web Push).
2. Prográmala con el **cron de Supabase**:
   ```sql
   select cron.schedule('resumen-semanal', '0 20 * * 0',
     $$ select net.http_post('https://TU-PROYECTO.functions.supabase.co/resumen') $$);
   ```
   (domingos a las 20:00).

---

## 5. Notificaciones push reales (aunque la app esté cerrada)

El service worker (`public/sw.js`) ya incluye los handlers `push` y
`notificationclick`. Para que lleguen mensajes:

1. Genera claves **VAPID** (`npx web-push generate-vapid-keys`).
2. Al activar el permiso, suscribe el navegador con `registration.pushManager.subscribe`
   usando la clave pública, y guarda la suscripción en Supabase.
3. Una Edge Function envía los push con `web-push` a esas suscripciones (p. ej. la
   propia `weekly-summary`, o los recordatorios de rutina).

## 6. Copia externa a Google Drive / Dropbox

- **Manual (sin programar):** en Datos, "Descargar copia" genera un JSON; súbelo a
  tu Drive/Dropbox desde el propio sistema.
- **Automática:** requiere OAuth del proveedor y una Edge Function que suba el
  archivo con su API (Google Drive API / Dropbox API). El patrón es el mismo que
  el banco: el token secreto vive en el servidor, no en el navegador.

## 7. Completar la importación bancaria (GoCardless)

La función `bank-sync` asume una cuenta ya autorizada. El flujo completo la
primera vez:

1. `POST /token/new/` → access token.
2. `POST /requisitions/` con tu `institution_id` → devuelve un `link`.
3. Rediriges al usuario a ese `link` para que autorice en la web de su banco.
4. Al volver, la requisition tiene los `accounts`; guardas el `accountId`.
5. A partir de ahí, `bank-sync` ya puede leer transacciones periódicamente.

## Resumen de qué va dónde

| Integración            | ¿Dónde vive?        | ¿Clave secreta? |
|------------------------|---------------------|-----------------|
| Precios cripto         | Navegador (directo) | No              |
| Precios acciones/ETF   | Edge Function       | Sí              |
| Banco (GoCardless)     | Edge Function       | Sí              |
| Reloj (Shortcuts)      | Edge Function       | Sí (token)      |
| Reloj (Fitbit/Garmin)  | Edge Function       | Sí (OAuth)      |
| Resumen semanal        | Edge Function + cron| Según envío     |
