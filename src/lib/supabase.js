import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si no hay credenciales, la app funciona en modo local (solo navegador).
export const cloudEnabled = Boolean(url && anonKey);

export const supabase = cloudEnabled ? createClient(url, anonKey) : null;
