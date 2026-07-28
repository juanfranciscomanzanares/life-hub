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

## Convenciones de UI

- Componentes `Card` y `SectionTitle` (definidos en `LifeDashboard.jsx`) para mantener el aspecto uniforme.
- Tema claro/oscuro mediante variables CSS en [src/index.css](src/index.css) (`--c-slate-*`, etc.). **No** usar colores Tailwind directos que se salten esas variables; la paleta ya está mapeada en [tailwind.config.js](tailwind.config.js).
- Animaciones definidas en `index.css` (`section-fade`, `dropdown-pop`, `nav-link`...): siempre con su variante en `@media (prefers-reduced-motion: reduce)`.
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
