// Motor de histórico y rachas por participante.
// Analiza TODAS las temporadas usando resultados_porra + porras,
// en orden cronológico de resolución (temporada, luego jornada).
// Limitación conocida: solo cubre porras registradas en la app
// (la base importada de la temporada no tiene desglose por porra).
import { supabase } from "./supabase.js";

// Umbrales de "destacable"
const U = {
  sequiaPuntuar: 5,     // 5+ porras sin puntuar
  sequiaVictoria: 5,    // 5+ porras sin victoria (V o U)
  sequiaUnica: 15,      // las únicas son raras: umbral más alto
  sequiaQuiniela: 8,
  rachaPuntuando: 3,    // 3+ porras seguidas puntuando
  rachaVictorias: 3,    // 3+ victorias seguidas
  rachaDerrotas: 3,
};

// Carga y ordena todos los eventos por jugador.
export async function cargarHistorico() {
  const [{ data: res }, { data: porras }, { data: temporadas }] = await Promise.all([
    supabase.from("resultados_porra").select("*"),
    supabase.from("porras").select("id, jornada, temporada_id, tipo, comp, sede, local, visitante"),
    supabase.from("temporadas").select("id, nombre"),
  ]);
  const pInfo = {}; (porras || []).forEach((p) => { pInfo[p.id] = p; });
  const tNombre = {}; (temporadas || []).forEach((t) => { tNombre[t.id] = t.nombre; });

  const porJugador = {};
  (res || []).forEach((r) => {
    const p = pInfo[r.porra_id]; if (!p) return;
    if (!porJugador[r.jugador]) porJugador[r.jugador] = [];
    porJugador[r.jugador].push({
      porraId: r.porra_id, temporadaId: r.temporada_id, temporada: tNombre[r.temporada_id] || "?",
      jornada: p.jornada ?? 0,
      etiqueta: p.tipo === "partido" ? `${p.local} - ${p.visitante}` : (p.sede || p.comp),
      tipo: r.tipo, extra: r.extra || 0, pt: r.pt || 0,
    });
  });
  // orden cronológico: temporada (id asc) y dentro, jornada asc; empate por porraId
  Object.values(porJugador).forEach((evs) =>
    evs.sort((a, b) => a.temporadaId - b.temporadaId || a.jornada - b.jornada || a.porraId - b.porraId)
  );
  return porJugador;
}

// Distancia "hace N porras" desde el último evento que cumple cond. null si nunca.
function ultimoY(evs, cond) {
  for (let i = evs.length - 1; i >= 0; i--) {
    if (cond(evs[i])) return { ev: evs[i], hace: evs.length - 1 - i };
  }
  return null;
}
// Racha actual desde el final mientras se cumpla cond.
function rachaActual(evs, cond) {
  let n = 0;
  for (let i = evs.length - 1; i >= 0; i--) { if (cond(evs[i])) n++; else break; }
  return n;
}

const esVictoria = (e) => e.tipo === "v" || e.tipo === "u";

// Analiza un jugador: últimas apariciones, sequías y rachas.
export function analizarJugador(evs) {
  if (!evs || evs.length === 0) return null;
  const ult = evs[evs.length - 1];
  const f = {
    total: evs.length,
    ultima: ult,
    ultimaVictoria: ultimoY(evs, esVictoria),
    ultimaUnica: ultimoY(evs, (e) => e.tipo === "u"),
    ultimaQuiniela: ultimoY(evs, (e) => e.tipo === "q"),
    ultimoExtra: ultimoY(evs, (e) => e.extra > 0),
    ultimaDerrota: ultimoY(evs, (e) => e.tipo === "d"),
    rachaPuntuando: rachaActual(evs, (e) => e.pt > 0),
    rachaVictorias: rachaActual(evs, esVictoria),
    rachaDerrotas: rachaActual(evs, (e) => e.tipo === "d"),
    sinPuntuar: rachaActual(evs, (e) => e.pt === 0),
  };
  return f;
}

// Texto "hace N porras (#J temporada T)" con cruce de temporadas.
function refEvento(item, temporadaActualId) {
  if (!item) return "nunca (en el registro)";
  const { ev, hace } = item;
  const dónde = ev.temporadaId === temporadaActualId
    ? `#${ev.jornada}`
    : `#${ev.jornada} de la temporada ${ev.temporada}`;
  return hace === 0 ? `en esta misma porra (${dónde})` : `hace ${hace} porras (${dónde})`;
}

// Genera la lista de DESTACADOS de todos los jugadores.
// porraReciente: id de la última porra calculada (para hitos), puede ser null.
export function generarDestacados(porJugador, temporadaActualId, porraRecienteId = null) {
  const out = [];
  Object.entries(porJugador).forEach(([jugador, evs]) => {
    const a = analizarJugador(evs); if (!a) return;
    const ult = a.ultima;
    const enEsta = porraRecienteId && ult.porraId === porraRecienteId;

    // Hitos de la porra recién calculada
    if (enEsta) {
      if (ult.tipo === "u") {
        const previas = evs.slice(0, -1).filter((e) => e.tipo === "u").length;
        if (previas === 0) out.push({ jugador, nivel: "hito", texto: `${jugador} logra su PRIMERA única registrada 💎` });
        else {
          const prevU = ultimoY(evs.slice(0, -1), (e) => e.tipo === "u");
          if (prevU && prevU.hace + 1 >= U.sequiaUnica) out.push({ jugador, nivel: "hito", texto: `${jugador} vuelve a lograr una única ${refEvento({ ev: prevU.ev, hace: prevU.hace + 1 }, temporadaActualId)} después 💎` });
        }
      }
      if (esVictoria(ult)) {
        const prevV = ultimoY(evs.slice(0, -1), esVictoria);
        if (prevV && prevV.hace + 1 >= U.sequiaVictoria) out.push({ jugador, nivel: "hito", texto: `${jugador} rompe una sequía de ${prevV.hace + 1} porras sin victoria 🔥` });
        if (!prevV && evs.length > U.sequiaVictoria) out.push({ jugador, nivel: "hito", texto: `${jugador} logra su primera victoria registrada 🎉` });
      }
      if (ult.pt > 0) {
        const maxPrevio = Math.max(0, ...evs.slice(0, -1).filter((e) => e.temporadaId === temporadaActualId).map((e) => e.pt));
        if (ult.pt > maxPrevio && maxPrevio > 0) out.push({ jugador, nivel: "hito", texto: `${jugador} firma su mejor porra de la temporada (${ult.pt} pts) 📈` });
      }
    }

    // Rachas activas
    if (a.rachaVictorias >= U.rachaVictorias) out.push({ jugador, nivel: "racha", texto: `${jugador} encadena ${a.rachaVictorias} victorias seguidas 🔥` });
    else if (a.rachaPuntuando >= U.rachaPuntuando) out.push({ jugador, nivel: "racha", texto: `${jugador} lleva ${a.rachaPuntuando} porras seguidas puntuando ✅` });
    if (a.rachaDerrotas >= U.rachaDerrotas) out.push({ jugador, nivel: "sequia", texto: `${jugador} acumula ${a.rachaDerrotas} derrotas seguidas 🥶` });

    // Sequías
    if (a.sinPuntuar >= U.sequiaPuntuar) out.push({ jugador, nivel: "sequia", texto: `${jugador} lleva ${a.sinPuntuar} porras sin puntuar ❄️` });
    const sv = a.ultimaVictoria;
    if (sv && sv.hace >= U.sequiaVictoria && a.sinPuntuar < U.sequiaPuntuar) out.push({ jugador, nivel: "sequia", texto: `${jugador} no gana desde ${refEvento(sv, temporadaActualId)} 😬` });
    const su = a.ultimaUnica;
    if (su && su.hace >= U.sequiaUnica) out.push({ jugador, nivel: "dato", texto: `${jugador} no logra una única desde ${refEvento(su, temporadaActualId)}` });
    if (!su && evs.length >= U.sequiaUnica) out.push({ jugador, nivel: "dato", texto: `${jugador} aún no tiene ninguna única registrada` });
    const sq = a.ultimaQuiniela;
    if (sq && sq.hace >= U.sequiaQuiniela) out.push({ jugador, nivel: "dato", texto: `${jugador} no hace quiniela desde ${refEvento(sq, temporadaActualId)}` });
  });

  const orden = { hito: 0, racha: 1, sequia: 2, dato: 3 };
  return out.sort((x, y) => orden[x.nivel] - orden[y.nivel]);
}

// Ficha legible de un jugador para la UI.
export function fichaJugador(evs, temporadaActualId) {
  const a = analizarJugador(evs); if (!a) return [];
  return [
    ["Porras registradas", String(a.total)],
    ["Última victoria", refEvento(a.ultimaVictoria, temporadaActualId)],
    ["Última única", refEvento(a.ultimaUnica, temporadaActualId)],
    ["Última quiniela", refEvento(a.ultimaQuiniela, temporadaActualId)],
    ["Último punto extra", refEvento(a.ultimoExtra, temporadaActualId)],
    ["Racha puntuando", a.rachaPuntuando > 0 ? `${a.rachaPuntuando} porras` : "—"],
    ["Racha de victorias", a.rachaVictorias > 0 ? `${a.rachaVictorias}` : "—"],
    ["Sin puntuar", a.sinPuntuar > 0 ? `${a.sinPuntuar} porras` : "—"],
  ];
}
