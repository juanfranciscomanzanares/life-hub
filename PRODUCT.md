# Product

<!-- impeccable:product-schema 1 -->

Los encabezados van en inglés porque es el esquema que lee la skill; el contenido
va en español, como todo lo demás del proyecto.

## Platform

web

## Users

Dos personas, cada una con su cuenta de Supabase y sus datos completamente
aislados (ver `src/lib/sesionLocal.js`). No hay ni habrá más audiencia: esto no
es un producto que se venda ni se comparta.

- **Quico** (Juan Francisco), dueño del proyecto. Compagina el último curso del
  Grado en Ciencia e Ingeniería de Datos (Facultad de Informática, UMU) con un
  trabajo en Agrosana, además de gimnasio, tenis de mesa y sus propias finanzas.
  Usa todas las secciones.
- **Carmen**, perfil añadido en agosto de 2026. Va a usar la aplicación entera
  igual que Quico, **salvo las dos secciones de tenis de mesa**. Sus datos de
  carrera están pendientes (ver Capabilities and Constraints).

**Las dos situaciones de uso pesan lo mismo**, y esto manda sobre cualquier
decisión de diseño:

- **Móvil**, instalada como PWA en vertical: vistazos cortos sobre la marcha
  para ver qué toca ahora.
- **Ordenador**: sesiones más largas para meter datos y revisar gráficas.

Ninguna de las dos es "la principal". Un diseño que optimice solo una de ellas
está mal para este producto.

## Product Purpose

Reunir en un solo sitio lo que si no estaría repartido entre el Aula Virtual, la
app del banco, una hoja de cálculo y la memoria: qué hay que entregar, cuándo es
el examen, cuántas horas se han trabajado este mes, en qué se va el dinero, si se
ha ido al gimnasio.

Tiene éxito cuando responde **"qué me toca hoy"** en segundos y cuando apuntar
algo cuesta tan poco que uno lo apunta de verdad. Un panel que da pereza rellenar
deja de tener datos, y sin datos no sirve para nada.

## Positioning

No compite con nadie: es de uso propio. Lo que un panel genérico no podría
copiar es la **especificidad**, y ahí está el valor:

- Conoce el horario real de la Facultad de Informática de la UMU, con el
  subgrupo de prácticas concreto y el aula.
- Conoce el calendario académico de esa facultad, incluidos festivos que ninguna
  API pública tiene (la Romería, San Alberto Magno).
- Conoce las condiciones de trabajo reales: modalidad presencial o teletrabajo,
  y kilómetros contados por día presencial, no por registro.

Esa exactitud es el producto. Generalizarlo lo estropearía.

## Operating Context

- **PWA instalada**, `display: standalone`, orientación vertical en el móvil.
- **Funciona sin conexión.** `localStorage` es la fuente de verdad y Supabase es
  solo sincronización; la app tiene que ser usable sin red.
- **Varios dispositivos a la vez.** Los conflictos se resuelven elemento a
  elemento, con tumbas para los borrados (`src/lib/fusionar.js`).
- **APIs externas de dos clases**: las que no llevan secretos (tiempo con
  Open-Meteo, festivos con Nager.Date) van directas desde el navegador; las que
  sí (banco, Aula Virtual, bolsa) van por Edge Function.
- **Navegación por hash** (`#/gimnasio`), para no depender de reescrituras en el
  servidor. El botón "atrás" de Android tiene que funcionar.
- **Todo en español**: interfaz, comentarios del código y commits.

## Capabilities and Constraints

Secciones actuales: Inicio, Universidad, Trabajo, Gimnasio, Tenis de mesa
(resultados y entrenamientos), Salud, Finanzas, Plan financiero, Inversiones,
Hábitos, Metas, Calendario, Próximos, Modo foco, Segundo Cerebro, Analítica,
Datos y Ajustes. **Todas menos Datos y Ajustes son de uso casi diario**, así que
no hay un puñado de pantallas "importantes" donde concentrar el esfuerzo: lo que
se toque tiene que valer para el conjunto.

Restricciones que cualquier trabajo futuro debe respetar:

- **Nada de datos de ejemplo.** Un registro inventado en un dispositivo nuevo se
  sube a Supabase como si fuera real. Los catálogos (asignaturas, categorías) sí
  pueden venir rellenos.
- Cada elemento sincronizable necesita `id` de `nuevoId()`, nunca `Date.now()`.
- Las claves de almacenamiento llevan prefijo `lh_`.
- Las secciones se cargan con `lazy()`; solo Inicio entra en el trozo inicial.
- Lógica pura en `src/lib/*.js` con sus tests; `npm run lint`, `npm test` y
  `npm run build` tienen que pasar antes de dar algo por terminado.

Decisiones **explícitamente pendientes**, que no hay que inventar:

- Los datos de carrera de Carmen (universidad, grado, asignaturas, horario,
  exámenes, festivos propios de su facultad) y el correo de su cuenta. Hasta que
  lleguen, Universidad y Calendario le muestran los de Quico.
- El repositorio es público a fecha de hoy y va a pasar a privado antes de que
  se escriban los datos de Carmen.

## Brand Commitments

- Nombre: **Life Hub**. Subtítulo "Panel personal".
- **Logo**: núcleo con tres satélites en órbita. Vive en dos sitios que hay que
  cambiar a la vez: el componente `Logo` de `src/lib/ui.jsx` y `public/icon.svg`.
- **Tipografía**: Inter para texto, Space Grotesk para títulos y cifras grandes.
  Las cifras siempre con `tabular-nums`.
- **Voz**: español, de tú, cercana y concreta. Los estados vacíos explican qué
  hacer ("Nada apuntado. Usa el botón + de abajo a la derecha"), no se limitan a
  decir que no hay nada.
- **Tres capas de color que no se mezclan**: acento global (elegible), color de
  sección (por área) y mundo del perfil (fondo y neutros). Están documentadas en
  CLAUDE.md y son una decisión tomada, no una sugerencia.
- El saludo **"olaaaa tomta"** del perfil de Carmen es un guiño personal
  deliberado. No es texto de relleno y no se "corrige".

## Evidence on Hand

Todos los datos son reales y propios de quien usa la app. **No hay** clientes,
testimonios, métricas de negocio, precios ni casos de estudio, y no debe
inventarse ninguno: no tendría sentido en un panel personal.

El horario, el calendario académico y las fechas de examen salen de documentos
oficiales de la UMU, citados en los comentarios de `src/lib/uni.js` y
`src/lib/datosUni.js` (resguardo de matrícula de 28/07/2026 y calendario
aprobado en Consejo de Gobierno de 06/03/2026).

## Product Principles

1. **"Qué toca hoy" va primero.** Cualquier pantalla que tarde en contestar eso
   está fallando en lo único que se le pide todos los días.
2. **Apuntar tiene que costar poco.** La fricción al meter un dato es la causa
   número uno de que un panel personal se abandone.
3. **Un dato vive en un solo sitio.** Duplicarlo ya provocó el fantasma de las
   "29 h totales con todas las asignaturas a 0"; la fuente única no es
   preferencia, es una lección aprendida.
4. **Nada inventado.** Registros vacíos, y lo que no se sabe se deja marcado como
   pendiente en vez de rellenarse con algo plausible.
5. **Móvil y escritorio a la par.** No hay una experiencia principal y otra
   tolerada.

## Accessibility & Inclusion

No hay una necesidad clínica declarada, pero sí un estándar que el proyecto ya
se ha impuesto y que cuenta como requisito:

- Contraste medido, no elegido a ojo. El texto cumple 4,5:1 sobre su fondo real
  en los dos temas y en los dos mundos de perfil.
- Toda animación tiene su variante en `@media (prefers-reduced-motion: reduce)`,
  entendida como "menos movimiento", no como "ninguna animación".
- Los modales usan `useDialogo`: foco atrapado, cierre con Escape y foco devuelto
  a quien abrió.
- Los iconos decorativos van con `aria-hidden`, y todo botón que solo lleve icono
  necesita `aria-label`. Ojo con los botones cuyo texto se oculta en móvil.
- La app se usa en vertical en el móvil: nada puede depender de pasar el ratón
  por encima.
