// Galería: guarda las imágenes generadas en el bucket y lleva su histórico.
import { supabase } from "./supabase.js";

const BUCKET = "escudos"; // reutilizamos el bucket público ya existente

function dataUrlABlob(dataUrl) {
  const [cab, b64] = dataUrl.split(",");
  const mime = (cab.match(/:(.*?);/) || [])[1] || "image/png";
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

// Guarda una imagen generada y la registra en el histórico.
export async function guardarImagen({ dataUrl, tipo, titulo, temporadaId, porraId }) {
  const path = `galeria/${tipo}_${porraId || "x"}_${Date.now()}.png`;
  const blob = dataUrlABlob(dataUrl);
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true, contentType: "image/png",
  });
  if (upErr) return { error: upErr };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error } = await supabase.from("imagenes").insert({
    temporada_id: temporadaId || null,
    porra_id: porraId || null,
    tipo, titulo: titulo || null,
    url: data.publicUrl, path,
  });
  return { error, url: data.publicUrl };
}

// ¿Ya hay una imagen de este tipo guardada para esta porra?
export async function existeImagen(porraId, tipo) {
  if (!porraId) return false;
  const { data } = await supabase.from("imagenes").select("id").eq("porra_id", porraId).eq("tipo", tipo).limit(1);
  return (data || []).length > 0;
}

// Guarda automáticamente la primera imagen de cada tipo por porra.
// Si ya había una, no guarda nada y avisa para que decida el admin.
export async function guardarAuto(opts) {
  if (await existeImagen(opts.porraId, opts.tipo)) return { duplicado: true };
  return guardarImagen(opts);
}

// Lista el histórico (más recientes primero).
export async function listarImagenes(temporadaId = null) {
  let q = supabase.from("imagenes").select("*").order("creada", { ascending: false });
  if (temporadaId) q = q.eq("temporada_id", temporadaId);
  const { data } = await q;
  return data || [];
}

// Borra una imagen del histórico y del bucket.
export async function borrarImagen(img) {
  if (img.path) await supabase.storage.from(BUCKET).remove([img.path]);
  const { error } = await supabase.from("imagenes").delete().eq("id", img.id);
  return { error };
}
