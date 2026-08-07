// Copia de seguridad: descarga toda la base de datos en un único archivo JSON.
import { supabase } from "./supabase.js";

const TABLAS = [
  "temporadas",
  "participantes",
  "equipos",
  "clasificacion",
  "porras",
  "votos",
  "resultados_porra",
  "palmares",
];

// Descarga todas las tablas. onProgress(nombreTabla, filas) para ir informando.
export async function exportarBackup(onProgress = () => {}) {
  const datos = { generado: new Date().toISOString(), version: 1, tablas: {} };
  for (const t of TABLAS) {
    const { data, error } = await supabase.from(t).select("*");
    if (error) throw new Error(`Error leyendo ${t}: ${error.message}`);
    datos.tablas[t] = data || [];
    onProgress(t, (data || []).length);
  }
  return datos;
}

// Genera el archivo y lo descarga en el navegador.
export async function descargarBackup(onProgress) {
  const datos = await exportarBackup(onProgress);
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const fecha = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lhdma_backup_${fecha}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  const total = Object.values(datos.tablas).reduce((n, f) => n + f.length, 0);
  return { total, tablas: Object.keys(datos.tablas).length };
}
