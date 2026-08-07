import { supabase } from "./supabase.js";

export async function getTemporadaActiva() {
  const { data } = await supabase.from("temporadas").select("*").eq("activa", true).maybeSingle();
  return data;
}

export async function listarTemporadas() {
  const { data } = await supabase.from("temporadas").select("*").order("creada", { ascending: false });
  return data || [];
}

// Crea una temporada nueva y la marca como única activa.
// Las demás quedan archivadas (activa=false), pero intactas.
export async function nuevaTemporada(nombre) {
  await supabase.from("temporadas").update({ activa: false }).eq("activa", true);
  const { data, error } = await supabase.from("temporadas").insert({ nombre, activa: true }).select().single();
  return { data, error };
}

export async function getParticipantes(temporadaId) {
  const { data } = await supabase.from("participantes").select("*").eq("temporada_id", temporadaId).order("nombre");
  return data || [];
}

// --- Gestión del histórico (solo admin) ---
export async function renombrarTemporada(id, nombre) {
  return supabase.from("temporadas").update({ nombre }).eq("id", id);
}
export async function marcarCampeon(id, campeon) {
  return supabase.from("temporadas").update({ campeon }).eq("id", id);
}
export async function borrarTemporada(id) {
  // Borra en cascada porras/votos/clasificación/participantes (FK on delete cascade)
  return supabase.from("temporadas").delete().eq("id", id);
}
export async function getClasificacionTemporada(id) {
  const { data } = await supabase.from("clasificacion").select("*").eq("temporada_id", id);
  return data || [];
}
export async function actualizarFilaClasificacion(temporada_id, jugador, campos) {
  return supabase.from("clasificacion").update(campos).eq("temporada_id", temporada_id).eq("jugador", jugador);
}
export async function getPorrasTemporada(id) {
  const { data } = await supabase.from("porras").select("*").eq("temporada_id", id).order("jornada", { ascending: false });
  return data || [];
}

// --- Clasificación robusta: base + suma de resultados_porra ---
export async function recomponerClasificacion(temporadaId) {
  // base de partida
  const { data: base } = await supabase.from("clasificacion").select("*").eq("temporada_id", temporadaId);
  // todas las filas de resultados de la temporada
  const { data: res } = await supabase.from("resultados_porra").select("*").eq("temporada_id", temporadaId);

  const acc = {}; // jugador -> {ap,d,e,q,u,v,sdp,pt}
  const init = (j) => { if (!acc[j]) acc[j] = { jugador: j, ap: 0, d: 0, e: 0, q: 0, u: 0, v: 0, sdp: 0, pt: 0 }; };

  // 1) base de partida
  (base || []).forEach((b) => {
    init(b.jugador);
    acc[b.jugador].ap += b.ap || 0; acc[b.jugador].d += b.d || 0; acc[b.jugador].e += b.e || 0;
    acc[b.jugador].q += b.q || 0; acc[b.jugador].u += b.u || 0; acc[b.jugador].v += b.v || 0;
    acc[b.jugador].sdp += b.sdp || 0; acc[b.jugador].pt += b.pt || 0;
  });

  // 2) sumar cada resultado de porra
  (res || []).forEach((r) => {
    init(r.jugador);
    const a = acc[r.jugador];
    a.ap += 1;
    if (r.tipo === "d") a.d += 1;
    if (r.tipo === "q") a.q += 1;
    if (r.tipo === "u") a.u += 1;
    if (r.tipo === "v") a.v += 1;
    if (r.extra) a.e += r.extra;
    a.sdp += r.sdp || 0;
    a.pt += r.pt || 0;
  });

  return Object.values(acc).sort((x, y) => y.pt - x.pt || y.sdp - x.sdp);
}

// Totales agregados de una temporada para el panel lateral de la imagen.
export async function getTotalesTemporada(temporadaId) {
  const filas = await recomponerClasificacion(temporadaId);
  const { data: porras } = await supabase.from("porras").select("id, cerrada, comentarios").eq("temporada_id", temporadaId).eq("cerrada", true);
  // nº de líderes distintos a lo largo de la temporada (quién fue 1º tras cada porra)
  const pasos = await evolucionLideres(temporadaId);
  const lideres = new Set(pasos);
  const tot = filas.reduce((a, f) => ({
    ap: a.ap + (f.ap || 0), v: a.v + (f.v || 0), u: a.u + (f.u || 0),
    q: a.q + (f.q || 0), e: a.e + (f.e || 0), d: a.d + (f.d || 0),
    pt: a.pt + (f.pt || 0), sdp: a.sdp + (f.sdp || 0),
  }), { ap: 0, v: 0, u: 0, q: 0, e: 0, d: 0, pt: 0, sdp: 0 });
  return {
    campeon: filas[0]?.jugador || "—",
    jugadores: filas.length,
    porras: (porras || []).length,
    lideres: lideres.size || 1,
    victorias: tot.v + tot.u,        // totales (comunes + únicas)
    victoriasComunes: tot.v,
    unicas: tot.u,
    quinielas: tot.q,
    extras: tot.e,
    derrotas: tot.d,
    apuestas: tot.ap,
    puntos: tot.pt,
    sdp: tot.sdp,
  };
}

// Devuelve la lista de quién fue líder tras cada porra cerrada (para contar líderes distintos).
async function evolucionLideres(temporadaId) {
  const { data: base } = await supabase.from("clasificacion").select("*").eq("temporada_id", temporadaId);
  const { data: res } = await supabase.from("resultados_porra").select("*").eq("temporada_id", temporadaId);
  const { data: porras } = await supabase.from("porras").select("id, jornada, cerrada").eq("temporada_id", temporadaId).eq("cerrada", true);
  const cerradas = (porras || []).sort((a, b) => (a.jornada ?? 0) - (b.jornada ?? 0) || a.id - b.id);
  const resPorPorra = {};
  (res || []).forEach((r) => { (resPorPorra[r.porra_id] = resPorPorra[r.porra_id] || []).push(r); });
  const acum = {};
  (base || []).forEach((b) => { acum[b.jugador] = { pt: b.pt || 0, sdp: b.sdp || 0 }; });
  const lideres = [];
  cerradas.forEach((p) => {
    (resPorPorra[p.id] || []).forEach((r) => {
      acum[r.jugador] = acum[r.jugador] || { pt: 0, sdp: 0 };
      acum[r.jugador].pt += r.pt || 0; acum[r.jugador].sdp += r.sdp || 0;
    });
    const lider = Object.entries(acum).sort((a, b) => b[1].pt - a[1].pt || b[1].sdp - a[1].sdp)[0];
    if (lider) lideres.push(lider[0]);
  });
  return lideres;
}

// Récords históricos comparando TODAS las temporadas. Devuelve frases para el cajetín.
export async function getRecordsHistoricos(temporadaActualId) {
  const temporadas = await listarTemporadas();
  const totalesPorTemp = {};
  let recPuntos = { v: 0, jug: null, temp: null };
  let recUnicas = { v: 0, jug: null, temp: null };
  let recSdp = { v: 0, jug: null, temp: null };
  let recPtAp = { v: 0, jug: null, temp: null };

  for (const t of temporadas) {
    const filas = await recomponerClasificacion(t.id);
    totalesPorTemp[t.id] = filas;
    filas.forEach((f) => {
      if ((f.pt || 0) > recPuntos.v) recPuntos = { v: f.pt, jug: f.jugador, temp: t.nombre };
      if ((f.u || 0) > recUnicas.v) recUnicas = { v: f.u, jug: f.jugador, temp: t.nombre };
      if ((f.sdp || 0) > recSdp.v) recSdp = { v: f.sdp, jug: f.jugador, temp: t.nombre };
      const ratio = (f.ap || 0) > 0 ? (f.pt || 0) / f.ap : 0;
      if (ratio > recPtAp.v) recPtAp = { v: ratio, jug: f.jugador, temp: t.nombre };
    });
  }

  // récords de la temporada actual (para destacar si se batió alguno este año)
  const tActual = temporadas.find((t) => t.id === temporadaActualId);
  const nombreActual = tActual?.nombre;
  const records = [];
  if (recPuntos.jug) records.push({ texto: `Récord puntuación total: ${recPuntos.jug} (${recPuntos.v} pts, T${recPuntos.temp})`, esActual: recPuntos.temp === nombreActual });
  if (recUnicas.jug) records.push({ texto: `Récord victorias únicas: ${recUnicas.jug} (${recUnicas.v}, T${recUnicas.temp})`, esActual: recUnicas.temp === nombreActual });
  if (recPtAp.jug) records.push({ texto: `Récord puntos/apuesta: ${recPtAp.jug} (${recPtAp.v.toFixed(4).replace(".", ",")}, T${recPtAp.temp})`, esActual: recPtAp.temp === nombreActual });
  if (recSdp.jug) records.push({ texto: `Récord SDP: ${recSdp.jug} (${recSdp.v.toLocaleString("es-ES")}, T${recSdp.temp})`, esActual: recSdp.temp === nombreActual });
  return records;
}

// Movimiento de cada jugador respecto a ANTES de la última porra calculada.
// Devuelve { jugador -> delta } donde delta>0 = subió puestos, <0 = bajó.
export async function getMovimientos(temporadaId) {
  // última porra cerrada (la más reciente por id)
  const { data: ultimas } = await supabase.from("resultados_porra")
    .select("porra_id").eq("temporada_id", temporadaId);
  if (!ultimas || ultimas.length === 0) return {};
  const ultimaPorra = Math.max(...ultimas.map((r) => r.porra_id));

  const actual = await recomponerClasificacion(temporadaId);

  // recomponer SIN la última porra
  const { data: base } = await supabase.from("clasificacion").select("*").eq("temporada_id", temporadaId);
  const { data: res } = await supabase.from("resultados_porra").select("*").eq("temporada_id", temporadaId);
  const acc = {};
  const init = (j) => { if (!acc[j]) acc[j] = { jugador: j, pt: 0, sdp: 0 }; };
  (base || []).forEach((b) => { init(b.jugador); acc[b.jugador].pt += b.pt || 0; acc[b.jugador].sdp += b.sdp || 0; });
  (res || []).filter((r) => r.porra_id !== ultimaPorra).forEach((r) => { init(r.jugador); acc[r.jugador].pt += r.pt || 0; acc[r.jugador].sdp += r.sdp || 0; });
  const previa = Object.values(acc).sort((x, y) => y.pt - x.pt || y.sdp - x.sdp);

  const posPrev = {}; previa.forEach((f, i) => { posPrev[f.jugador] = i + 1; });
  const mov = {};
  actual.forEach((f, i) => {
    const antes = posPrev[f.jugador];
    mov[f.jugador] = antes ? (antes - (i + 1)) : 0; // positivo = subió
  });
  return mov;
}

// Descalcular una porra: borra sus resultados y la reabre (cerrada=false),
// conservando los votos. La clasificación se recompone sin esta porra.
export async function descalcularPorra(porraId) {
  await supabase.from("resultados_porra").delete().eq("porra_id", porraId);
  return supabase.from("porras").update({ cerrada: false, resultado: null }).eq("id", porraId);
}

// Borrar una porra entera (resultados y votos caen en cascada).
export async function borrarPorra(porraId) {
  return supabase.from("porras").delete().eq("id", porraId);
}

// Sugerencias para crear porras: competiciones y sedes ya usadas, y siguiente jornada.
export async function getSugerenciasPorra(temporadaId) {
  const { data } = await supabase.from("porras").select("jornada, comp, sede").eq("temporada_id", temporadaId);
  const porras = data || [];
  const comps = [...new Set(porras.map((p) => p.comp).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const sedes = [...new Set(porras.map((p) => p.sede).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  const maxJornada = porras.reduce((m, p) => Math.max(m, p.jornada || 0), 0);
  return { comps, sedes, siguienteJornada: maxJornada + 1 };
}

// Devuelve un mapa jugador -> {pt, sdp} de lo que sumó una porra concreta.
export async function getResultadoPorra(porraId) {
  const { data } = await supabase.from("resultados_porra").select("jugador, pt, sdp").eq("porra_id", porraId);
  const map = {};
  (data || []).forEach((r) => { map[r.jugador] = { pt: r.pt || 0, sdp: r.sdp || 0 }; });
  return map;
}

// Palmarés: mapa jugador -> nº de temporadas ganadas (estrellas).
export async function getPalmares() {
  const { data } = await supabase.from("palmares").select("jugador, titulos");
  const map = {};
  (data || []).forEach((r) => { map[r.jugador] = r.titulos || 0; });
  return map;
}

// Suma +1 título al palmarés de un jugador (al cerrar temporada con campeón).
export async function sumarTitulo(jugador) {
  const { data } = await supabase.from("palmares").select("titulos").eq("jugador", jugador).maybeSingle();
  const actual = data?.titulos || 0;
  return supabase.from("palmares").upsert({ jugador, titulos: actual + 1 }, { onConflict: "jugador" });
}
