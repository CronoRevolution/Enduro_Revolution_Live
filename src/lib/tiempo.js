// Utilidades de tiempo. El cierre se guarda en UTC (ISO).
// El admin piensa en hora de España peninsular (Europe/Madrid).

const TZ = "Europe/Madrid";

// ¿La porra está cerrada para votar? (por flag manual o por fecha pasada)
export function estaCerrada(porra) {
  if (porra.cerrada) return true;
  if (porra.cierra_en) return new Date(porra.cierra_en).getTime() <= Date.now();
  return false;
}

// Formatea un instante UTC para mostrarlo en hora de Madrid.
export function formatoMadrid(iso) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

// Convierte lo que el admin escribe en un <input type="datetime-local">
// (que el navegador interpreta como hora LOCAL del dispositivo) a un
// instante UTC correcto asumiendo que esa hora era hora de Madrid.
// Esto evita que, si el admin viaja o tiene mal el reloj, se desfase.
export function inputMadridAUTC(valorDatetimeLocal) {
  if (!valorDatetimeLocal) return null;
  // valorDatetimeLocal: "2026-08-15T21:00"
  const [fecha, hora] = valorDatetimeLocal.split("T");
  const [y, m, d] = fecha.split("-").map(Number);
  const [hh, mm] = hora.split(":").map(Number);
  // Construimos el instante interpretando los componentes como hora de Madrid.
  // Truco: formateamos una fecha UTC tentativa en TZ Madrid y ajustamos el offset.
  const tentativa = Date.UTC(y, m - 1, d, hh, mm);
  const offset = offsetMadridMs(new Date(tentativa));
  return new Date(tentativa - offset).toISOString();
}

// Offset (ms) de Madrid respecto a UTC en una fecha dada (maneja verano/invierno).
function offsetMadridMs(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUTC - date.getTime();
}

// Para precargar un input datetime-local con un valor UTC existente,
// mostrándolo en hora de Madrid.
export function utcAInputMadrid(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const off = offsetMadridMs(d);
  const local = new Date(d.getTime() + off);
  return local.toISOString().slice(0, 16);
}

// Devuelve un texto de cuenta atrás tipo "3h 12m" o "2d 4h" hasta una fecha.
export function tiempoRestante(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "cerrada";
  const min = Math.floor(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
