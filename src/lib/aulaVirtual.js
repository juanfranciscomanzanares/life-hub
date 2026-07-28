import { supabase, cloudEnabled } from "./supabase";

/*
  Cliente de la sincronización con el Aula Virtual (Sakai) de la UMU.

  El usuario y la contraseña solo viven en el estado del componente que llama
  a esta función: no se guardan en usePersisted ni en localStorage, así que no
  viajan a Supabase salvo en esta petición puntual, que es la que los usa para
  iniciar sesión en el Aula Virtual y los descarta.
*/

export const FUNCION = "aula-virtual-sync";

export async function sincronizarAulaVirtual({ usuario, contrasena }) {
  if (!cloudEnabled) throw new Error("Necesitas la nube configurada (Supabase) para sincronizar.");
  if (!usuario?.trim() || !contrasena) throw new Error("Pon tu usuario y contraseña de la UMU.");

  const { data, error } = await supabase.functions.invoke(FUNCION, {
    body: { usuario: usuario.trim(), contrasena },
  });
  if (error) throw new Error(error.message || "No se pudo contactar con el servidor.");
  if (data?.error) throw new Error(data.error);
  return data.tareas ?? [];
}
