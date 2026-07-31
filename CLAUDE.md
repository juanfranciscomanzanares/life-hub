# Life Hub

Panel personal (universidad, trabajo, deporte, finanzas, hábitos...) hecho con
React 18 + Vite + Tailwind. Persistencia local con `localStorage` y
sincronización opcional con Supabase. Todo el texto de la interfaz, los
comentarios y los commits van **en español**.

## Comandos

```bash
npm run dev        # servidor de desarrollo (Vite)
npm run build      # build de producción
npm test           # tests (vitest, una pasada)
npm run test:watch # tests en modo watch
npm run lint       # eslint (lo importante: no-undef y react-hooks)
```

Ejecuta `npm run lint`, `npm test` y `npm run build` antes de dar por terminado
un cambio. El lint no es cosmético: `no-undef` es lo único que detecta un import
que se queda atrás al mover código entre archivos, porque eso **no rompe el
build** y solo revienta al abrir esa pantalla en el navegador.

## Arquitectura

- [src/main.jsx](src/main.jsx) → [src/App.jsx](src/App.jsx) (auth/candado) → [src/LifeDashboard.jsx](src/LifeDashboard.jsx), que es **solo el shell** (cabecera con navegación agrupada, barra inferior del móvil) más la sección Inicio, que se carga de inmediato por ser la primera que se ve.
- **Todas** las demás secciones viven en `src/sections/` y se cargan con `lazy()` desde `LifeDashboard.jsx`. No vuelvas a escribir una sección dentro del shell: seis de ellas estaban ahí y su código entraba en el trozo inicial aunque nunca las abrieras.
- La navegación se define en `NAV_GROUPS` (grupos con desplegable) dentro de `LifeDashboard.jsx`; `NAV` (lista plana) se deriva de ahí, alimenta la paleta de comandos (Ctrl+K) y da la lista de ids válidos para la ruta.
- **La sección abierta va en la URL** (`#/gimnasio`), con el hook `useRuta` de [src/lib/ruta.js](src/lib/ruta.js). Es lo que hace que el botón "atrás" del móvil vuelva a la sección anterior en vez de cerrar la app, y que recargar te deje donde estabas. Se usa hash y no rutas normales para no tener que configurar reescrituras en Vercel ni en el service worker.
- Estado persistente: hook `usePersisted(clave, inicial)` de [src/lib/store.js](src/lib/store.js). Las claves siempre con prefijo `lh_` (p. ej. `lh_habits`). Ese mismo store sincroniza con Supabase si hay sesión.
- Lógica pura testeable en `src/lib/*.js` con su `*.test.js` al lado (vitest). Los tests que necesitan montar componentes llevan `// @vitest-environment jsdom` en la primera línea; el resto corre en `node`, que es mucho más rápido.

### Sincronización entre dispositivos

Los conflictos se resuelven **elemento a elemento**, no por bloques (ver [src/lib/fusionar.js](src/lib/fusionar.js)). Antes ganaba el bloque con la fecha más nueva, así que apuntar un gasto en el móvil y otro en el PC hacía desaparecer uno de los dos. Lo que hay que saber al tocar esto:

- **Cada elemento necesita `id`, y ese id lo da `nuevoId()` de [src/lib/id.js](src/lib/id.js).** Nunca `Date.now()`: dos dispositivos en el mismo milisegundo darían el mismo id, la fusión los tomaría por el mismo elemento y perdería uno. `nuevoId()` lleva parte aleatoria justo para eso.
- **La fusión se decide por la FORMA del dato, no por una lista de claves.** Array de objetos con `id` → por elemento; objeto llano → por clave de primer nivel; lo demás (números, textos, arrays sin id como los partidos de tenis) → gana el más reciente, como antes. Una sección nueva hereda la fusión sola si sus elementos llevan `id`.
- **Borrar deja una tumba** con su fecha, que se poda a los 90 días. Sin tumba, el otro dispositivo "aportaría" el elemento borrado y este resucitaría.
- **En localStorage el valor se guarda pelado**, igual que siempre; las marcas van aparte en `lh_sync:<clave>`. Lo que viaja a Supabase es un sobre `{_lh, datos, meta}`. Si alguna vez metes las marcas dentro del valor, rompes la paleta de comandos y las copias de seguridad, que leen esas claves directamente.
- **Cuidado con varios componentes que escriben la misma clave** (`lh_finance` la tocan Finanzas y el añadido rápido, por ejemplo). El store los mantiene en sincronía dentro de la pestaña; sin eso, el que tuviera la lista vieja enterraría lo que acaba de añadir el otro, y con tumbas ese borrado sería definitivo y en todos los dispositivos. Los tests de [src/lib/store.sync.test.jsx](src/lib/store.sync.test.jsx) vigilan justo eso.
- **Horas de estudio: una sola fuente, `lh_study_log`** (registro con fecha). El contador `lh_study_hours` está muerto: no se lee ni se escribe. Tener lo mismo en dos sitios acabó enseñando "29h totales" con todas las asignaturas a 0, porque la cabecera sumaba el objeto entero —incluidas asignaturas de cursos anteriores— y la lista solo pintaba las de `SUBJECTS`. Los cálculos van por [src/lib/estudio.js](src/lib/estudio.js), y `totalHoras` recibe a propósito la lista de asignaturas a contar: si sumas más de las que se ven, vuelve el fantasma.
- Las tareas de `lh_uni_tasks` pueden llevar `entrega` (fecha) y `hora`. Con fecha salen en el Calendario (tipo `Tarea`, con su color, distinto del de las clases) y en "lo de hoy" de Inicio. Al darlas por terminadas se ofrece apuntar las horas dedicadas, que van al mismo `lh_study_log` con el id de la tarea en el campo `tarea`.
- `lh_uni_convalidadas` marca las asignaturas convalidadas (el caso es Prácticas Externas). Una convalidada no cuenta horas ni sale en el gráfico: dejarla a 0 para siempre solo estropea la comparación.
- Los registros de trabajo (`lh_work_log`) llevan `modalidad` (`"oficina"` / `"teletrabajo"`, ausente en los antiguos) y, opcionalmente, `km`. Los kilómetros se cuentan **por día presencial**, no por registro: ver `diasEnOficina` en [src/lib/trabajo.js](src/lib/trabajo.js). La distancia habitual vive aparte, en `lh_trabajo_km_trayecto`.

## Convenciones de UI

- **Logo**: la marca (núcleo + 3 satélites en órbita) vive en dos sitios que hay que cambiar a la vez — el componente `Logo` de [src/lib/ui.jsx](src/lib/ui.jsx), que usa el degradado de Tailwind para seguir el acento elegido, y [public/icon.svg](public/icon.svg), con el degradado fijo, del que salen los PNG (`npx -y sharp-cli -i public/icon.svg -o <dir> --format png resize N N`) y la pantalla de carga de `index.html`. Al tocar iconos, sube `VERSION` en [public/sw.js](public/sw.js).
- **Pantalla de carga**: está escrita a mano en [index.html](index.html) (estilos propios, sin Tailwind: se ve antes de que llegue el bundle). Va fuera de `#root` porque el guardián de errores mira si `#root` tiene hijos, y la retira [src/main.jsx](src/main.jsx) tras el primer pintado.
- Componentes `Card`, `SectionTitle`, `Skeleton`, `SkeletonSeccion` y `Logo`, todos en [src/lib/ui.jsx](src/lib/ui.jsx). **No** volver a definirlos en otro archivo: estuvieron duplicados en `LifeDashboard.jsx` y las dos copias se separaron.
- Tema claro/oscuro mediante variables CSS en [src/index.css](src/index.css) (`--c-slate-*`, etc.). **No** usar colores Tailwind directos ni hex fijos que se salten esas variables; la paleta ya está mapeada en [tailwind.config.js](tailwind.config.js). Única excepción: colores de serie con significado propio en una gráfica (verde = ganado, rojo = perdido).
- **Dos capas de color, no las mezcles**:
  - *Acento global* (`indigo-*` → `--c-indigo-*`, redefinidas por `html[data-accent]`, ver `ACENTOS` en [src/lib/useTheme.js](src/lib/useTheme.js)): botones, enlaces y foco. Lo elige el usuario en Ajustes.
  - *Color de sección* (`seccion-*` → `--c-seccion-*`, redefinidas por `data-seccion` que pone el shell): título de sección, resplandor superior y detalles propios del área. Gimnasio acero, tenis rojo, dinero verde, etc.
- Gráficas nuevas: la curva suave sale de `caminoSuave` ([src/lib/curva.js](src/lib/curva.js)), que es una spline **monótona**. No la cambies por una Bézier normal: esa se inventa valles y picos entre puntos, y con kg o euros eso es mentir.
- **Tipografía**: `font-sans` (Inter) para texto y `font-display` (Space Grotesk) para títulos y cifras grandes. Las cifras, con `tabular-nums` o con el componente `Cifra` de [src/lib/animar.jsx](src/lib/animar.jsx), que además las anima al aparecer.
- **Cristal**: el aspecto de las tarjetas vive en la clase `.lh-card` de `index.css`, no en clases sueltas. El desenfoque solo se aplica desde 640px por rendimiento en el móvil. Cuidado: `backdrop-filter` crea bloque contenedor, así que nada con `position: fixed` puede ir dentro de una tarjeta.
- Animaciones definidas en `index.css` (`section-fade`, `lh-card`, `lh-barra`, `lh-skeleton`...): siempre con su variante en `@media (prefers-reduced-motion: reduce)`. El confeti de [src/lib/confetti.js](src/lib/confetti.js) se calla solo en ese caso.
- Registros iniciales vacíos (nada de datos de ejemplo): un dispositivo nuevo podría subirlos a Supabase como si fueran reales. Los catálogos (asignaturas, categorías) sí pueden ir rellenos.
- **Ventanas flotantes**: cualquier modal usa el hook `useDialogo` de [src/lib/useDialogo.js](src/lib/useDialogo.js) y lleva `role="dialog"`, `aria-modal="true"` y un nombre (`aria-label` o `aria-labelledby`). El hook atrapa el tabulador dentro, cierra con Escape y devuelve el foco a quien abrió. Sin él, tabulando se sale del modal hacia botones tapados por el velo y el foco parece perdido.
- Los iconos decorativos van con `aria-hidden="true"`, y todo botón que solo lleve icono necesita `aria-label`. Ojo con los botones cuyo texto se oculta en móvil (`hidden sm:block`): ahí el nombre accesible desaparece con él.

## Skills y agentes disponibles

- `/nueva-seccion` — pasos para añadir una sección nueva al panel.
- `/revision-diseno` — checklist de diseño/UX antes de dar por buena una pantalla.
- Agente `revisor-ui` — revisa cambios de interfaz (accesibilidad, temas, responsive).

## MCP

`.mcp.json` configura el servidor **Playwright MCP** (navegador controlable para
ver la app en marcha y hacer capturas). Opcional: el [MCP oficial de Supabase](https://github.com/supabase/mcp-server-supabase)
(`npx -y @supabase/mcp-server-supabase`) si quieres consultar la base de datos
desde Claude; necesita un token de acceso personal de Supabase.
