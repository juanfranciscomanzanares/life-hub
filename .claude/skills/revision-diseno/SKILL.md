---
name: revision-diseno
description: Checklist de diseño/UX de Life Hub para revisar una pantalla o cambio de interfaz antes de darlo por bueno (temas, responsive, animaciones, accesibilidad).
---

# Revisión de diseño de Life Hub

Repasa el cambio de interfaz contra esta lista y corrige lo que falle.
Al terminar, informa punto por punto de lo comprobado.

## Tema claro y oscuro

- [ ] Probar la pantalla en ambos temas (botón sol/luna). Los colores deben
      venir de la paleta mapeada a variables CSS en `src/index.css`; un color
      "hardcodeado" (hex o clase fuera de la paleta) se verá mal en claro.
- [ ] Verde = positivo/ingreso, rojo/rosa = negativo/gasto, en los dos temas.

## Responsive

- [ ] Móvil (~375px): sin scroll horizontal; tablas anchas dentro de un
      contenedor `overflow-x-auto`.
- [ ] Los grids usan `grid-cols-1` de base y `sm:`/`lg:` para ensanchar.
- [ ] La cabecera superior no tapa contenido (es sticky): nada de `fixed`
      propio dentro de secciones.

## Animaciones

- [ ] Entradas de sección con `section-fade` (ya lo aplica el shell); no añadir
      otra animación de entrada encima.
- [ ] Cualquier animación nueva va en `src/index.css` con nombre `lh-*` y su
      desactivación en `@media (prefers-reduced-motion: reduce)`.
- [ ] Duraciones cortas (≤ 0.35s) y curvas suaves; nada que parpadee o rebote.

## Consistencia

- [ ] Tarjetas con `Card`, títulos con `SectionTitle`, inputs con el estilo
      `rounded-lg border border-slate-700 bg-slate-800 ...` que usan las demás.
- [ ] Botón primario indigo, destructivo rose, confirmación emerald.
- [ ] Estados vacíos con mensaje en español, no huecos en blanco.
- [ ] Borrados con `removeWithUndo` (toast con deshacer), no borrado seco.

## Accesibilidad

- [ ] Botones de solo icono con `title` o `aria-label`.
- [ ] El foco por teclado se ve (ya hay `:focus-visible` global; no quitarlo).
- [ ] Contraste suficiente en textos secundarios (mínimo `text-slate-400`
      sobre fondo oscuro; en claro se remapea solo).
