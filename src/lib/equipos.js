import { supabase } from "./supabase.js";

export async function listarEquipos() {
  const { data } = await supabase.from("equipos").select("*").order("nombre");
  return data || [];
}

// Sube un escudo al bucket "escudos" y crea/actualiza el equipo.
export async function guardarEquipo(nombre, file) {
  const limpio = nombre.trim();
  if (!limpio) return { error: { message: "Nombre vacío." } };

  let escudo_url = null;
  if (file) {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${limpio.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("escudos").upload(path, file, { upsert: true });
    if (upErr) return { error: upErr };
    const { data } = supabase.storage.from("escudos").getPublicUrl(path);
    escudo_url = data.publicUrl;
  }

  const reg = { nombre: limpio };
  if (escudo_url) reg.escudo_url = escudo_url;
  const { error } = await supabase.from("equipos").upsert(reg, { onConflict: "nombre" });
  return { error };
}

export async function getEquipo(nombre) {
  const { data } = await supabase.from("equipos").select("*").eq("nombre", nombre).maybeSingle();
  return data;
}

// Sube varios escudos de golpe. El nombre del equipo se saca del nombre
// del archivo (sin extensión). Devuelve { ok, errores: [...] }.
export async function guardarEquiposEnLote(files) {
  let ok = 0; const errores = [];
  for (const file of files) {
    const nombre = file.name.replace(/\.[^.]+$/, "").trim(); // quita extensión
    const { error } = await guardarEquipo(nombre, file);
    if (error) errores.push(`${nombre}: ${error.message}`);
    else ok++;
  }
  return { ok, errores };
}

// Sube una imagen de cabecera (para porras especiales) al bucket público.
// Devuelve { url } o { error }.
export async function subirCabecera(file) {
  try {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `cabeceras/cab_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("escudos").upload(path, file, { upsert: true });
    if (upErr) return { error: upErr };
    const { data } = supabase.storage.from("escudos").getPublicUrl(path);
    return { url: data.publicUrl };
  } catch (e) {
    return { error: e };
  }
}
