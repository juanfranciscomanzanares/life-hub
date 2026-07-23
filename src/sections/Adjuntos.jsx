import { useState } from "react";
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

export default function Adjuntos() {
  const [items, setItems] = usePersisted("lh_adjuntos", []);
  const [titulo, setTitulo] = useState("");
  const [cargando, setCargando] = useState(false);

  const subir = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    try {
      let registro = { id: Date.now(), fecha: todayISO(), titulo: titulo || file.name };
      if (cloudEnabled) {
        // Sube el archivo original a Supabase Storage (bucket "adjuntos")
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const path = `${user?.id || "anon"}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("adjuntos").upload(path, file, { upsert: false });
        if (error) throw error;
        const { data } = supabase.storage.from("adjuntos").getPublicUrl(path);
        registro.url = data.publicUrl;
        registro.remoto = true;
      } else {
        registro.url = await downscale(file); // dataURL local reducido
      }
      setItems([registro, ...items]);
      setTitulo("");
    } catch (err) {
      alert("No se pudo subir: " + (err.message || err) + "\n(Si usas la nube, crea el bucket 'adjuntos' en Supabase; ver docs/INTEGRACIONES.md)");
    } finally {
      setCargando(false);
      e.target.value = "";
    }
  };

  return (
    <div>
      <SectionTitle icon={Image} title="Adjuntos" subtitle="Fotos de progreso, apuntes o tickets" />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <input
            placeholder="Título (opcional)"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
            <Upload size={16} /> {cargando ? "Subiendo..." : "Subir imagen"}
            <input type="file" accept="image/*" onChange={subir} disabled={cargando} className="hidden" />
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {cloudEnabled ? "Se guardan en tu almacenamiento de Supabase." : "Sin nube: se guardan reducidas en este dispositivo."}
        </p>
      </Card>

      {items.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-500">Aún no has subido nada.</Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <Card key={it.id} className="p-2">
              <div className="mb-2 overflow-hidden rounded-lg bg-slate-800">
                <img src={it.url} alt={it.titulo} className="h-40 w-full object-cover" data-noinvert />
              </div>
              <div className="flex items-start justify-between gap-1 px-1">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-200">{it.titulo}</p>
                  <p className="text-xs text-slate-500">{it.fecha}</p>
                </div>
                <button onClick={() => removeWithUndo(items, setItems, it.id, "Adjunto")} className="shrink-0 text-slate-500 hover:text-rose-400">
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
