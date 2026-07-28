---
name: nueva-seccion
description: Añadir una sección nueva al panel de Life Hub siguiendo las convenciones del proyecto (lazy load, NAV_GROUPS, usePersisted, tema claro/oscuro).
---

# Añadir una sección nueva a Life Hub

Sigue estos pasos en orden. El objetivo es que la sección nueva sea
indistinguible en estilo y estructura de las que ya existen.

## 1. Crear el componente

- Archivo nuevo en `src/sections/NombreSeccion.jsx`, con export por defecto.
- Usa los componentes `Card` y `SectionTitle` (cópialos como referencia de
  `src/sections/Metas.jsx` o similar — cada sección lazy define/importa los suyos).
- Todo el texto de la interfaz en español.
- Empieza la pantalla con `<SectionTitle icon={...} title="..." subtitle="..." />`.
- Si la sección lista registros, incluye siempre un estado vacío con mensaje
  (`"Aún no hay..."`), nunca una tabla vacía sin explicación.

## 2. Estado persistente

- Usa `usePersisted("lh_<clave>", valorInicial)` de `src/lib/store.js`.
- La clave siempre con prefijo `lh_` y en minúsculas (p. ej. `lh_lecturas`).
- El valor inicial de registros de usuario debe ser vacío (`[]` o `{}`): nada
  de datos de ejemplo, porque el store los puede subir a Supabase.
- Para borrar elementos usa `removeWithUndo` de `src/lib/toast.js` (deshacer).

## 3. Registrarla en LifeDashboard.jsx

1. Import diferido junto a los demás:
   `const NombreSeccion = lazy(() => import("./sections/NombreSeccion.jsx"));`
2. Entrada en `NAV_GROUPS`: dentro del grupo temático que corresponda
   (Deporte, Dinero, Planificar, Conocimiento, Sistema) con `{ id, label, icon }`.
   Icono de `lucide-react`. No crear grupo nuevo salvo que ninguno encaje.
3. Ruta en el bloque `<Suspense>`: `{active === "id" && <NombreSeccion />}`.

Con eso la sección aparece automáticamente en la paleta de comandos (Ctrl+K),
porque `NAV` se deriva de `NAV_GROUPS`.

## 4. Estilo y tema

- Solo clases Tailwind ya usadas en el proyecto (slate/indigo/emerald/amber/rose...).
  Los colores pasan por variables CSS de `src/index.css`, así que el tema claro
  funciona solo si no te inventas colores fuera de la paleta mapeada.
- Nada de `position: fixed` dentro de secciones (rompe con el header sticky).

## 5. Lógica y tests

- Si hay cálculos no triviales (agregaciones, rachas, fechas), sácalos a un
  módulo puro `src/lib/<nombre>.js` y añade `src/lib/<nombre>.test.js` (vitest).
- Termina ejecutando `npm test` y `npm run build`.
