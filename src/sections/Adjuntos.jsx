import { useState, useEffect } from "react";
import { Image, Upload, Trash2 } from "lucide-react";
import { usePersisted } from "../lib/store";
import { removeWithUndo } from "../lib/toast";
import { supabase, cloudEnabled } from "../lib/supabase";
import { Card, SectionTitle, todayISO } from "../lib/ui";

// Reduce la imagen a máx 900px y la devuelve como dataURL (JPEG) para no ocupar mucho
function downscale(file, max = 900) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const reader = new FileReader();
    reader.onload = () => (img.src = reader.result);
    reader.onerror = reject;
    img.onload = () => {
      const escala = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const DURACION_FIRMA = 60 * 60; // 1 hora

/*
  Ruta del archivo dentro del bucket.

  Los registros nuevos guardan `path`. Los antiguos guardaban la URL pública
  completa, que ya no funciona porque el bucket pasó a ser privado; de esos
  extraemos la ruta para poder seguir mostrándolos.
*/
function rutaDeAdjunto(it) {
  if (it.path) return it.path;
  if (!it.remoto || !it.url) return null;
  const m = it.url.match(/\/object\/public\/adjuntos\/(.+)$/);
  return m ? decodeURIComponent(m[1].split("?")[0]) : null;
}

export default function Adjuntos() {
  const [items, setItems] = usePersisted("lh_adjuntos", []);
  const [titulo, setTitulo] = useState("");
  const [cargando, setCargando] = useState(false);
  // URLs firmadas, en memoria: caducan, así que no se persisten.
  const [firmadas, setFirmadas] = useState({});

  useEffect(() => {
    if (!cloudEnabled) return;
    const pendientes = items.filter((it) => it.remoto && !firmadas[it.id] && rutaDeAdjunto(it));
    if (pendientes.length === 0) return;

    let vivo = true;
    (async () => {
      const rutas = pendientes.map(rutaDeAdjunto);
      const { data, error } = await supabase.storage
        .from("adjuntos")
        .createSignedUrls(rutas, DURACION_FIRMA);
      if (!vivo || error || !data) {
        if (error) console.warn("No se pudieron firmar los adjuntos:", error.message);
        return;
      }
      const nuevas = {};
      data.forEach((firma, i) => {
        if (firma?.signedUrl) nuevas[pendientes[i].id] = firma.signedUrl;
      });
      if (Object.keys(nuevas).length) setFirmadas((prev) => ({ ...prev, ...nuevas }));
    })();

    return () => {
      vivo = false;
    };
  }, [items, firmadas]);

  const subir = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    try {
      let registro = { id: Date.now(), fecha: todayISO(), titulo: titulo || file.name };
      if (cloudEnabled) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) throw new Error("Sesión no disponible.");
        // La carpeta es el id de usuario: de ahí cuelga la política de acceso.
        const path = `${user.id}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("adjuntos").upload(path, file, { upsert: false });
        if (error) throw error;
        // Guardamos la ruta, no una URL: el bucket es privado y las URLs
        // firmadas caducan, así que se piden en cada carga.
        registro.path = path;
        registro.remoto = true;
      } else {
        registro.url = await downscale(file); // dataURL local reducido
      }
      setItems([registro, ...items]);
      setTitulo("");
    } catch (err) {
      alert(
        "No se pudo subir: " + (err.message || err) +
          "\n(Si usas la nube, ejecuta supabase-schema.sql para crear el bucket 'adjuntos'.)"
      );
    } finally {
      setCargando(false);
      e.target.value = "";
    }
  };

  const fuente = (it) => (it.remoto ? firmadas[it.id] : it.url);

  return (
    <div>
      <SectionTitle icon={Image} title="Adjuntos" subtitle="Fotos de progreso, apuntes o tickets" />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <label htmlFor="adjunto-titulo" className="sr-only">
            Título del adjunto
          </label>
          <input
            id="adjunto-titulo"
            name="adjunto-titulo"
            placeholder="Título (opcional)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
            <Upload size={16} /> {cargando ? "Subiendo..." : "Subir imagen"}
            <input
              type="file"
              accept="image/*"
              onChange={subir}
              disabled={cargando}
              className="hidden"
              name="adjunto-archivo"
            />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {cloudEnabled
            ? "Se guardan en tu almacenamiento privado de Supabase. Solo tú puedes verlos."
            : "Sin nube: se guardan reducidas en este dispositivo."}
        </p>
      </Card>

      {items.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-500">Aún no has subido nada.</Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <Card key={it.id} className="p-2">
              <div className="mb-2 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-slate-800">
                {fuente(it) ? (
                  <img
                    src={fuente(it)}
                    alt={it.titulo}
                    className="h-40 w-full object-cover"
                    loading="lazy"
                    data-noinvert
                  />
                ) : (
                  <span className="text-xs text-slate-500">Cargando...</span>
                )}
              </div>
              <div className="flex items-start justify-between gap-1 px-1">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">{it.titulo}</p>
                  <p className="text-xs text-slate-500">{it.fecha}</p>
                </div>
                <button
                  onClick={() => removeWithUndo(items, setItems, it.id, "Adjunto")}
                  aria-label={`Borrar ${it.titulo}`}
                  className="shrink-0 text-slate-500 hover:text-rose-400"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
