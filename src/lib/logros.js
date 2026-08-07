// Motor de logros y medallas.
// IMPORTANTE: los logros se calculan SOLO sobre la temporada indicada,
// no sobre todo el histórico. Se apoya en los eventos de historico.js.

// Definición de los logros. cond({ evs }) devuelve false o un texto de detalle.
export const LOGROS = [
  {
    key: "francotirador", emoji: "🎯", nombre: "Francotirador", desc: "Lograr una victoria única",
    cond: ({ evs }) => {
      const n = evs.filter((e) => e.tipo === "u").length;
      return n > 0 && (n === 1 ? "1 única" : `${n} únicas`);
    },
  },
  {
    key: "tirador_elite", emoji: "🏹", nombre: "Tirador de élite", desc: "3 victorias únicas o más",
    cond: ({ evs }) => {
      const n = evs.filter((e) => e.tipo === "u").length;
      return n >= 3 && `${n} únicas`;
    },
  },
  {
    key: "racha_5", emoji: "🔥", nombre: "En racha", desc: "5 porras seguidas puntuando",
    cond: ({ evs }) => {
      const r = rachaMax(evs, (e) => e.pt > 0);
      return r >= 5 && `mejor racha: ${r}`;
    },
  },
  {
    key: "racha_10", emoji: "🌋", nombre: "Imparable", desc: "10 porras seguidas puntuando",
    cond: ({ evs }) => {
      const r = rachaMax(evs, (e) => e.pt > 0);
      return r >= 10 && `mejor racha: ${r}`;
    },
  },
  {
    key: "genio", emoji: "🧠", nombre: "Genio", desc: "10 victorias acumuladas",
    cond: ({ evs }) => {
      const n = evs.filter((e) => e.tipo === "v" || e.tipo === "u").length;
      return n >= 10 && `${n} victorias`;
    },
  },
  {
    key: "abuson", emoji: "💪", nombre: "Abusón", desc: "20 victorias acumuladas",
    cond: ({ evs }) => {
      const n = evs.filter((e) => e.tipo === "v" || e.tipo === "u").length;
      return n >= 20 && `${n} victorias`;
    },
  },
  {
    key: "centenario", emoji: "🎖️", nombre: "Centenario", desc: "Jugar 100 porras",
    cond: ({ evs }) => evs.length >= 100 && `${evs.length} porras jugadas`,
  },
  {
    key: "resurreccion", emoji: "🧟", nombre: "Resurrección", desc: "Puntuar tras 5+ porras en blanco",
    cond: ({ evs }) => {
      let seco = 0, mejor = 0;
      evs.forEach((e) => {
        if (e.pt === 0) seco++;
        else { if (seco >= 5) mejor = Math.max(mejor, seco); seco = 0; }
      });
      return mejor > 0 && `rompió una sequía de ${mejor}`;
    },
  },
  {
    key: "manita", emoji: "✋", nombre: "Manita", desc: "Hacer 5 o más puntos en una porra",
    cond: ({ evs }) => {
      const mejor = Math.max(0, ...evs.map((e) => e.pt || 0));
      return mejor >= 5 && `mejor porra: ${mejor} pts`;
    },
  },
];

function rachaMax(evs, cond) {
  let cur = 0, max = 0;
  evs.forEach((e) => { if (cond(e)) { cur++; max = Math.max(max, cur); } else cur = 0; });
  return max;
}

// Logros de un jugador dentro de una temporada concreta.
export function logrosDeJugador(evs, temporadaId = null) {
  const propios = temporadaId == null ? (evs || []) : (evs || []).filter((e) => e.temporadaId === temporadaId);
  if (propios.length === 0) return [];
  const ctx = { evs: propios };
  return LOGROS.map((l) => {
    const detalle = l.cond(ctx);
    return detalle ? { ...l, detalle } : null;
  }).filter(Boolean);
}

// Logros de todos los jugadores en una temporada. { jugador: [logros] }
export function logrosDeTodos(porJugador, temporadaId = null) {
  const out = {};
  Object.entries(porJugador).forEach(([jug, evs]) => {
    const propios = temporadaId == null ? evs : evs.filter((e) => e.temporadaId === temporadaId);
    if (propios.length > 0) out[jug] = logrosDeJugador(evs, temporadaId);
  });
  return out;
}
