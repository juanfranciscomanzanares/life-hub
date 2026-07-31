/*
  Utilidades numéricas compartidas.

  `redondear` estaba escrito dos veces, palabra por palabra, en trabajo.js y en
  plan.js. Y el peor síntoma no era la copia: la sección de Finanzas importaba
  el de `trabajo` para cuadrar euros, porque era el que tenía a mano. Vive aquí,
  que no es de nadie, y los dos módulos lo reexportan para no romper lo que ya
  los importaba.
*/

/*
  A dos decimales.

  Sumar importes en coma flotante arrastra restos (0.1 + 0.2 = 0.30000000000004)
  y esos restos acaban en pantalla: un balance que debería ser 0 aparece como
  -0.000000001 y con él la flecha roja de "estás en números rojos".
*/
export const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;
