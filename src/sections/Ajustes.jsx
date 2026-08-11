import { Settings, RotateCcw, Palette, Check, UserRound } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle } from "../lib/ui";
import { ACENTOS, useAccent } from "../lib/useTheme";
import { PERFILES, PERFIL_POR_DEFECTO, ajustesIniciales } from "../lib/perfiles";

/*
  `perfil` siempre lo pasa el shell, pero el valor por defecto está puesto para
  que la sección no reviente si alguna vez se monta suelta (un test, una ruta
  antigua). Antes se mezclaban `perfil?.acento` y `perfil.nombre` en el mismo
  archivo, que es lo peor de las dos opciones: ni protege ni se lee.
*/
export default function Ajustes({ perfil = PERFILES[PERFIL_POR_DEFECTO], origenPerfil = "defecto" }) {
  const [aj, setAj] = usePersisted("lh_settings", ajustesIniciales(perfil));
  const [, setPerfilElegido] = usePersisted("lh_perfil", null);
  const { accent, setAccent, fijado } = useAccent(perfil.acento);

  /*
    Si el correo de la cuenta ya identifica al perfil, elegirlo a mano no haría
    nada (el correo manda, ver src/lib/perfiles.js). Ahí se enseña cuál es y por
    qué no se toca, en vez de un selector que no obedece.
  */
  const mandaElCorreo = origenPerfil === "correo";

  const set = (campo, valor) => setAj({ ...aj, [campo]: valor });
  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none";

  const rehacerTour = () => {
    localStorage.removeItem("lh_onboarded");
    alert("El tour de bienvenida volverá a aparecer al recargar.");
  };

  return (
    <div>
      <SectionTitle icon={Settings} title="Ajustes" subtitle="Personaliza tu Life Hub" />

      <Card className="mb-6">
        {/* "Tus datos" y no "Perfil": justo debajo hay una tarjeta "Perfil de la
            app" y, navegando por encabezados, dos "Perfil" seguidos no se
            distinguen. */}
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Tus datos</h2>
        {/*
          `htmlFor` + `id` en cada campo, y no solo el <label> suelto de antes.

          Un <label> sin `htmlFor` es texto decorativo: se VE al lado del campo
          pero no está unido a él, así que un lector de pantalla anunciaba
          "edición, en blanco" sin decir de qué. Es el fallo más repetido del
          proyecto y aquí se arregla en las tres pantallas que más se tocan.
        */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="aj-nombre" className="mb-1 block text-xs text-slate-400">Tu nombre</label>
            <input id="aj-nombre" value={aj.nombre} onChange={(e) => set("nombre", e.target.value)} className={inputCls} />
            <p className="mt-1 text-3xs text-slate-500">Se usa en el saludo de Inicio.</p>
          </div>
          <div>
            <label htmlFor="aj-agua" className="mb-1 block text-xs text-slate-400">Meta de agua (L/día)</label>
            <input id="aj-agua" type="number" step="0.1" value={aj.metaAgua} onChange={(e) => set("metaAgua", Number(e.target.value) || 0)} className={inputCls} />
            <p className="mt-1 text-3xs text-slate-500">Se usa en el medidor de hidratación (Salud).</p>
          </div>
          <div>
            <label htmlFor="aj-sueno" className="mb-1 block text-xs text-slate-400">Meta de sueño (h/día)</label>
            <input id="aj-sueno" type="number" step="0.5" value={aj.metaSueno} onChange={(e) => set("metaSueno", Number(e.target.value) || 0)} className={inputCls} />
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <UserRound size={18} className="text-indigo-400" aria-hidden="true" /> Perfil de la app
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Decide qué secciones existen y de qué color es la app. Los datos no se mezclan nunca entre
          perfiles: cada cuenta guarda los suyos.
        </p>

        {mandaElCorreo ? (
          <p className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-sm text-slate-300">
            Estás usando el perfil de <b className="text-slate-100">{perfil.nombre}</b>, reconocido
            por el correo de tu cuenta. No hace falta elegirlo a mano.
          </p>
        ) : (
          <>
            {/*
              Con `aria-pressed` y no con `role="radiogroup"`. Declarar radio
              obliga a moverse con las flechas y a un solo punto de tabulación,
              y aquí no había ni una cosa ni la otra: el lector anunciaba "botón
              de opción, 1 de 2", el usuario pulsaba flecha abajo y no pasaba
              nada. Además el grupo de acento de aquí al lado, que resuelve el
              mismo problema y se ve igual, ya usa `aria-pressed`: dos
              semánticas distintas para dos grupos gemelos confunden más de lo
              que aportan.
            */}
            <div className="flex flex-wrap gap-2">
              {Object.values(PERFILES).map((p) => {
                const activo = perfil.id === p.id;
                return (
                  <button
                    key={p.id}
                    aria-pressed={activo}
                    onClick={() => setPerfilElegido(p.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      activo
                        ? "border-indigo-500 bg-indigo-500/10 text-slate-100"
                        : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    {/* Hueco reservado siempre: si el icono apareciera y
                        desapareciera, el botón cambiaría de ancho al elegirlo y
                        la fila entera daría un salto. */}
                    <span className="flex h-4 w-4 items-center justify-center">
                      {activo && <Check size={14} aria-hidden="true" />}
                    </span>
                    {p.nombre}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Al cambiar de perfil cambian el menú y los colores, no los datos.
            </p>
          </>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Palette size={18} className="text-indigo-400" aria-hidden="true" /> Color de acento
        </h2>
        {fijado ? (
          <p className="text-sm text-slate-400">
            El perfil de <b className="text-slate-200">{perfil.nombre}</b> trae su propio color y no
            se cambia desde aquí: así se ve igual en el móvil y en el ordenador.
          </p>
        ) : (
          <>
            <p className="mb-4 text-xs text-slate-500">
              Cambia el color principal de toda la app: botones, enlaces, gráficas y el resaltado del
              teclado. Se aplica al instante y se recuerda en este dispositivo.
            </p>
            <div className="flex flex-wrap gap-2">
              {ACENTOS.map((a) => {
                const activo = accent === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setAccent(a.id)}
                    aria-pressed={activo}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      activo
                        ? "border-indigo-500 bg-indigo-500/10 text-slate-100"
                        : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ background: a.muestra }}
                    >
                      {activo && <Check size={13} className="text-white" aria-hidden="true" />}
                    </span>
                    {a.nombre}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-slate-100">General</h2>
        <div className="flex flex-wrap gap-3">
          <button onClick={rehacerTour} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-500">
            <RotateCcw size={16} /> Rehacer tour de bienvenida
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          El tema claro/oscuro y la búsqueda están en la barra lateral. Copias, cifrado y bloqueo, en Datos.
        </p>
      </Card>
    </div>
  );
}
