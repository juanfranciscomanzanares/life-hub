// Sistema de "toasts" con opción de deshacer, reutilizable en toda la app.
let listeners = [];

export function subscribe(fn) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

export function toast(mensaje, onUndo) {
  const t = { id: Date.now() + Math.random(), mensaje, onUndo };
  listeners.forEach((l) => l(t));
}

// Borra un elemento por id y ofrece deshacer (restaura el array anterior).
export function removeWithUndo(list, setList, id, label = "Elemento") {
  const prev = list;
  setList(list.filter((i) => i.id !== id));
  toast(`${label} borrado`, () => setList(prev));
}
