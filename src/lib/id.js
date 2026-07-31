/*
  Identificadores de elemento.

  Antes cada sección hacía `id: Date.now()`. Dentro de un dispositivo casi
  nunca falla, pero con la sincronización por elemento se convierte en un
  agujero: si añades un gasto en el móvil y otro en el PC en el mismo
  milisegundo, los dos salen con el MISMO id, la fusión los toma por el mismo
  elemento y uno desaparece sin decir nada. Y no es tan improbable como suena,
  porque varios sitios generaban ids en lote (`Date.now() + i`), que chocan en
  cuanto dos dispositivos hacen la misma operación.

  El id lleva ahora dos partes:
  - el reloj en base 36, que mantiene el orden de creación y hace legible el
    dato al depurar;
  - un sufijo aleatorio de 8 caracteres, que es lo que separa un dispositivo de
    otro. Con 36^8 posibilidades, dos ids del mismo milisegundo coinciden con
    una probabilidad de 1 entre 2,8 billones.

  Es una CADENA a propósito. Se comprobó antes de cambiarlo: en toda la app los
  id solo se comparan con ===, nunca se ordenan, no se hace aritmética con
  ellos y ninguno viaja por el DOM (donde habrían vuelto convertidos en texto).
  Los datos que ya estaban guardados conservan sus ids numéricos y siguen
  funcionando: un número y una cadena nunca van a chocar entre sí.
*/

const ALFABETO = "0123456789abcdefghijklmnopqrstuvwxyz";

/*
  crypto.getRandomValues cuando está (todos los navegadores y Node 20+), y
  Math.random como red de seguridad. Aquí no se protege nada secreto: solo se
  busca que dos dispositivos no coincidan, y para eso Math.random sobra.
*/
function azar(largo) {
  let salida = "";
  const cripto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cripto?.getRandomValues) {
    const bytes = cripto.getRandomValues(new Uint8Array(largo));
    for (let i = 0; i < largo; i++) salida += ALFABETO[bytes[i] % 36];
    return salida;
  }
  for (let i = 0; i < largo; i++) salida += ALFABETO[Math.floor(Math.random() * 36)];
  return salida;
}

export function nuevoId() {
  return Date.now().toString(36) + "-" + azar(8);
}
