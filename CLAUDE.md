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
```

Ejecuta `npm test` y `npm run build` antes de dar por terminado un cambio.

## Arquitectura

- [src/main.jsx](src/main.jsx) → [src/App.jsx](src/App.jsx) (auth/candado) → [src/LifeDashboard.jsx](src/LifeDashboard.jsx), que contiene el shell (cabecera superior con navegación agrupada) y algunas secciones inline (Inicio, Universidad, Finanzas, Hábitos, Trabajo, Segundo Cerebro).
- Las demás secciones viven en `src/sections/` y se cargan con `lazy()` desde `LifeDashboard.jsx` para no engordar el bundle inicial.
- La navegación se define en `NAV_GROUPS` (grupos con desplegable) dentro de `LifeDashboard.jsx`; `NAV` (lista plana) se deriva de ahí y alimenta la paleta de comandos (Ctrl+K).
- Estado persistente: hook `usePersisted(clave, inicial)` de [src/lib/store.js](src/lib/store.js). Las claves siempre con prefijo `lh_` (p. ej. `lh_habits`). Ese mismo store sincroniza con Supabase si hay sesión.
- Lógica pura testeable en `src/lib/*.js` con su `*.test.js` al lado (vitest).
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

## Skills y agentes disponibles

- `/nueva-seccion` — pasos para añadir una sección nueva al panel.
- `/revision-diseno` — checklist de diseño/UX antes de dar por buena una pantalla.
- Agente `revisor-ui` — revisa cambios de interfaz (accesibilidad, temas, responsive).

## MCP

`.mcp.json` configura el servidor **Playwright MCP** (navegador controlable para
ver la app en marcha y hacer capturas). Opcional: el [MCP oficial de Supabase](https://github.com/supabase/mcp-server-supabase)
(`npx -y @supabase/mcp-server-supabase`) si quieres consultar la base de datos
desde Claude; necesita un token de acceso personal de Supabase.
