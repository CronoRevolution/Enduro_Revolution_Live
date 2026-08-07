// Motor de estadísticas de diversión: gafe/talismán, cara a cara, mente colmena,
// gemelos, farolillo rojo, evolución de posiciones y proyección.
// Trabaja sobre los datos reales: porras, votos, resultados_porra y clasificación base.
import { supabase } from "./supabase.js";

// Carga todo lo necesario de una temporada (una sola vez).
export async function cargarDatosStats(temporadaId) {
  const [{ data: porras }, { data: resultados }, { data: base }] = await Promise.all([
    supabase.from("porras").select("*").eq("temporada_id", temporadaId),
    supabase.from("resultados_porra").select("*").eq("temporada_id", temporadaId),
    supabase.from("clasificacion").select("*").eq("temporada_id", temporadaId),
  ]);
  const ids = (porras || []).map((p) => p.id);
  let votos = [];
  if (ids.length) {
    const { data: vs } = await supabase.from("votos").select("*").in("porra_id", ids);
    votos = vs || [];
  }
  return { porras: porras || [], resultados: resultados || [], base: base || [], votos };
}

const signo = (l, v) => (l > v ? "1" : l < v ? "2" : "X");

// ===== 1. GAFE Y TALISMÁN =====
// Para partidos resueltos: cuando un jugador "confía" en un equipo (lo da ganador),
// ¿ese equipo gana de verdad? Devuelve por jugador su gafe (peor %) y talismán (mejor %).
export function gafeTalisman({ porras, votos }, minPicks = 3) {
  const partidos = porras.filter((p) => p.tipo === "partido" && p.cerrada && p.resultado);
  const porId = {}; partidos.forEach((p) => { porId[p.id] = p; });
  const cuenta = {}; // jugador -> equipo -> {picks, aciertos}
  votos.forEach((v) => {
    const p = porId[v.porra_id]; if (!p) return;
    const c = v.contenido; if (c?.local == null) return;
    const s = signo(c.local, c.visitante);
    if (s === "X") return; // no dio ganador
    const equipo = s === "1" ? p.local : p.visitante;
    const realS = signo(p.resultado.local, p.resultado.visitante);
    const gano = realS === s;
    cuenta[v.jugador] = cuenta[v.jugador] || {};
    cuenta[v.jugador][equipo] = cuenta[v.jugador][equipo] || { picks: 0, aciertos: 0 };
    cuenta[v.jugador][equipo].picks++;
    if (gano) cuenta[v.jugador][equipo].aciertos++;
  });
  const out = {};
  Object.entries(cuenta).forEach(([jug, eqs]) => {
    const lista = Object.entries(eqs)
      .filter(([, d]) => d.picks >= minPicks)
      .map(([eq, d]) => ({ equipo: eq, picks: d.picks, aciertos: d.aciertos, pct: Math.round((d.aciertos / d.picks) * 100) }));
    if (!lista.length) return;
    lista.sort((a, b) => a.pct - b.pct || b.picks - a.picks);
    out[jug] = { gafe: lista[0], talisman: lista[lista.length - 1] };
  });
  return out;
}

// ===== 3. MENTE COLMENA =====
// Por cada partido resuelto: el 1X2 mayoritario del grupo vs el real.
// Devuelve % de acierto del grupo y la media individual, para comparar.
export function menteColmena({ porras, votos }) {
  const partidos = porras.filter((p) => p.tipo === "partido" && p.cerrada && p.resultado);
  let grupoOk = 0, grupoTotal = 0, indivOk = 0, indivTotal = 0;
  partidos.forEach((p) => {
    const vs = votos.filter((v) => v.porra_id === p.id && v.contenido?.local != null);
    if (vs.length < 3) return;
    const realS = signo(p.resultado.local, p.resultado.visitante);
    const conteo = { "1": 0, X: 0, "2": 0 };
    vs.forEach((v) => { conteo[signo(v.contenido.local, v.contenido.visitante)]++; indivTotal++; if (signo(v.contenido.local, v.contenido.visitante) === realS) indivOk++; });
    const mayoria = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0][0];
    grupoTotal++;
    if (mayoria === realS) grupoOk++;
  });
  return {
    porrasAnalizadas: grupoTotal,
    grupoPct: grupoTotal ? Math.round((grupoOk / grupoTotal) * 100) : 0,
    indivPct: indivTotal ? Math.round((indivOk / indivTotal) * 100) : 0,
  };
}

// ===== 4. GEMELOS =====
// Parejas que votan idéntico (mismo marcador exacto en partidos, misma resp en especiales).
export function gemelos({ votos }, minComunes = 5, minPct = 60) {
  const porPorra = {};
  votos.forEach((v) => { porPorra[v.porra_id] = porPorra[v.porra_id] || []; porPorra[v.porra_id].push(v); });
  const pares = {}; // "A||B" -> {comunes, identicos}
  Object.values(porPorra).forEach((vs) => {
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
      const a = vs[i], b = vs[j];
      const key = [a.jugador, b.jugador].sort().join("||");
      pares[key] = pares[key] || { comunes: 0, identicos: 0 };
      pares[key].comunes++;
      if (JSON.stringify(a.contenido) === JSON.stringify(b.contenido)) pares[key].identicos++;
    }
  });
  return Object.entries(pares)
    .map(([k, d]) => ({ pareja: k.split("||"), ...d, pct: Math.round((d.identicos / d.comunes) * 100) }))
    .filter((d) => d.comunes >= minComunes && d.pct >= minPct)
    .sort((a, b) => b.pct - a.pct || b.comunes - a.comunes);
}

// ===== 6. EVOLUCIÓN DE POSICIONES =====
// Posición de cada jugador tras cada porra resuelta (en orden cronológico).
export function evolucionPosiciones({ porras, resultados, base }) {
  const cerradas = porras.filter((p) => p.cerrada).sort((a, b) => (a.jornada ?? 0) - (b.jornada ?? 0) || a.id - b.id);
  const acum = {};
  base.forEach((b) => { acum[b.jugador] = { pt: b.pt || 0, sdp: b.sdp || 0 }; });
  const resPorPorra = {};
  resultados.forEach((r) => { resPorPorra[r.porra_id] = resPorPorra[r.porra_id] || []; resPorPorra[r.porra_id].push(r); });
  const pasos = [];
  cerradas.forEach((p) => {
    (resPorPorra[p.id] || []).forEach((r) => {
      acum[r.jugador] = acum[r.jugador] || { pt: 0, sdp: 0 };
      acum[r.jugador].pt += r.pt || 0; acum[r.jugador].sdp += r.sdp || 0;
    });
    const orden = Object.entries(acum).sort((a, b) => b[1].pt - a[1].pt || b[1].sdp - a[1].sdp);
    const posiciones = {};
    orden.forEach(([jug], i) => { posiciones[jug] = i + 1; });
    pasos.push({ porraId: p.id, jornada: p.jornada ?? 0, etiqueta: p.tipo === "partido" ? `${p.local}-${p.visitante}` : (p.sede || p.comp), posiciones });
  });
  return pasos;
}

// ===== 5. FAROLILLO ROJO =====
export function farolillo(pasos) {
  if (!pasos.length) return null;
  const ult = pasos[pasos.length - 1];
  const n = Object.keys(ult.posiciones).length;
  const ultimo = Object.entries(ult.posiciones).find(([, pos]) => pos === n)?.[0];
  if (!ultimo) return null;
  // racha actual en última posición
  let racha = 0;
  for (let i = pasos.length - 1; i >= 0; i--) {
    const nn = Object.keys(pasos[i].posiciones).length;
    if (pasos[i].posiciones[ultimo] === nn) racha++; else break;
  }
  // récord histórico (mayor racha de cualquiera en último puesto)
  const rachas = {}; let record = { jugador: null, n: 0 };
  pasos.forEach((paso) => {
    const nn = Object.keys(paso.posiciones).length;
    Object.entries(paso.posiciones).forEach(([jug, pos]) => {
      rachas[jug] = pos === nn ? (rachas[jug] || 0) + 1 : 0;
      if (rachas[jug] > record.n) record = { jugador: jug, n: rachas[jug] };
    });
  });
  return { ultimo, racha, record };
}

// ===== 2. CARA A CARA =====
export function caraACara({ resultados }, jugA, jugB) {
  const porPorra = {};
  resultados.forEach((r) => { porPorra[r.porra_id] = porPorra[r.porra_id] || {}; porPorra[r.porra_id][r.jugador] = r; });
  let ganaA = 0, ganaB = 0, empates = 0; const detalle = [];
  Object.entries(porPorra).forEach(([pid, m]) => {
    if (!(jugA in m) || !(jugB in m)) return;
    const a = m[jugA].pt || 0, b = m[jugB].pt || 0;
    if (a > b) ganaA++; else if (b > a) ganaB++; else empates++;
    detalle.push({ porraId: +pid, a, b });
  });
  // racha actual del que domina (orden por porraId)
  detalle.sort((x, y) => x.porraId - y.porraId);
  let racha = 0, quien = null;
  for (let i = detalle.length - 1; i >= 0; i--) {
    const d = detalle[i];
    const g = d.a > d.b ? jugA : d.b > d.a ? jugB : null;
    if (g === null) break;
    if (quien === null) { quien = g; racha = 1; }
    else if (quien === g) racha++;
    else break;
  }
  return { comunes: detalle.length, ganaA, ganaB, empates, rachaDe: quien, racha };
}

// ===== 9. PROYECCIÓN =====
// Media de pts/porra de la temporada y proyección si quedan N porras.
export function proyeccion({ resultados, base }, restantes = 10) {
  const porJugador = {};
  resultados.forEach((r) => {
    porJugador[r.jugador] = porJugador[r.jugador] || { pt: 0, n: 0 };
    porJugador[r.jugador].pt += r.pt || 0; porJugador[r.jugador].n++;
  });
  const basePt = {}; base.forEach((b) => { basePt[b.jugador] = b.pt || 0; });
  const todos = new Set([...Object.keys(porJugador), ...Object.keys(basePt)]);
  const filas = [...todos].map((jug) => {
    const d = porJugador[jug] || { pt: 0, n: 0 };
    const actual = (basePt[jug] || 0) + d.pt;
    const ritmo = d.n ? d.pt / d.n : 0;
    return { jugador: jug, actual, ritmo: Math.round(ritmo * 100) / 100, proyectado: Math.round(actual + ritmo * restantes) };
  });
  return filas.sort((a, b) => b.proyectado - a.proyectado);
}
