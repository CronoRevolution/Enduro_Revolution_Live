// Vídeo Wrapped. Dos rutas:
//  - RÁPIDA: WebCodecs (VideoEncoder) + mp4-muxer → MP4 H.264 generado a velocidad de CPU.
//  - RESPALDO: MediaRecorder en tiempo real (navegadores sin WebCodecs).
// Devuelve { url, ext, metodo } con el blob del vídeo.
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

const W = 1080, H = 1500;
const COLS = ["#b794ff", "#fcd34d", "#4ade80", "#fb7185", "#22d3ee", "#f472b6"];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

function fondo(ctx, t) {
  ctx.fillStyle = "#0d0820"; ctx.fillRect(0, 0, W, H);
  const mancha = (x, y, r, col) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
  // manchas con leve deriva
  mancha(W * 0.15 + Math.sin(t * 0.7) * 40, H * 0.12, 600, "rgba(124,92,240,0.4)");
  mancha(W * 0.9 + Math.cos(t * 0.5) * 30, H * 0.38, 550, "rgba(244,114,182,0.3)");
  mancha(W * 0.2, H * 0.85 + Math.sin(t * 0.6) * 30, 600, "rgba(252,211,77,0.18)");
  mancha(W * 0.85, H * 0.95, 450, "rgba(34,211,238,0.2)");
}

function pieFijo(ctx) {
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(183,148,255,0.55)"; ctx.font = "800 22px system-ui";
  ctx.fillText("LA HOJA DE MIS APUESTAS", W / 2, H - 50);
}

// Texto grande con entrada (escala + fade)
function titulo(ctx, texto, y, t, color = "#fff", size = 80) {
  const k = easeOut(clamp01(t));
  ctx.save();
  ctx.globalAlpha = k;
  ctx.translate(W / 2, y);
  ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
  ctx.textAlign = "center";
  ctx.fillStyle = color; ctx.font = `900 ${size}px system-ui`;
  ctx.fillText(texto, 0, 0);
  ctx.restore();
}

// Construye la escena: devuelve { draw(T), total } reutilizable por ambas rutas.
function crearEscena(temporada, d) {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");

  // escenas de estadísticas individuales
  const stats = [
    ["🎯", "APUESTAS JUGADAS", String(d.fila.ap), COLS[0]],
    ["✅", "VICTORIAS", String((d.fila.v || 0) + (d.fila.u || 0)), COLS[2]],
    ["💎", "ÚNICAS", String(d.fila.u || 0), COLS[1]],
    ["📋", "QUINIELAS", String(d.fila.q || 0), COLS[4]],
    ["🔥", "MEJOR RACHA PUNTUANDO", d.rachaMax > 0 ? `${d.rachaMax}` : "—", COLS[3]],
    ["🏆", "MEJOR RACHA DE VICTORIAS", d.rachaVictoriasMax > 0 ? `${d.rachaVictoriasMax}` : "—", COLS[5]],
  ];
  if (d.resultadoFavorito) stats.push(["💜", "TU RESULTADO FAVORITO", d.resultadoFavorito, COLS[0]]);
  if (d.resultadoGanador) stats.push(["🎯", "TU RESULTADO MÁS GANADOR", d.resultadoGanador, COLS[1]]);

  const DUR_INTRO = 2.2, DUR_POS = 2.6, DUR_STAT = 1.7, DUR_EXTRA = (d.talisman || d.gafe) ? 2.4 : 0, DUR_FIN = 2.4;
  const total = DUR_INTRO + DUR_POS + stats.length * DUR_STAT + DUR_EXTRA + DUR_FIN;

  // confeti para la escena final
  const piezas = Array.from({ length: 90 }, () => ({
    x: Math.random() * W, y: -50 - Math.random() * H * 0.4,
    vx: (Math.random() - 0.5) * 3, vy: 4 + Math.random() * 6,
    sz: 8 + Math.random() * 12, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
    col: COLS[Math.floor(Math.random() * COLS.length)],
  }));

  const draw = (T) => {
    fondo(ctx, T);
    let t0 = 0;

    // INTRO
    if (T < (t0 += DUR_INTRO)) {
      const t = (T - (t0 - DUR_INTRO)) / DUR_INTRO;
      titulo(ctx, "MI TEMPORADA " + temporada.nombre, H / 2 - 120, t * 2, "#b794ff", 46);
      const gradN = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
      gradN.addColorStop(0, "#ffffff"); gradN.addColorStop(1, "#b794ff");
      ctx.save(); ctx.globalAlpha = easeOut(clamp01(t * 2 - 0.5));
      ctx.textAlign = "center"; ctx.fillStyle = gradN; ctx.font = "900 96px system-ui";
      ctx.fillText(d.jugador, W / 2, H / 2 + 20);
      if (d.titulos > 0) { ctx.font = "44px system-ui"; ctx.fillText("⭐".repeat(Math.min(d.titulos, 5)), W / 2, H / 2 + 90); }
      ctx.restore();
      pieFijo(ctx); return;
    }
    // POSICIÓN
    if (T < (t0 += DUR_POS)) {
      const t = (T - (t0 - DUR_POS)) / DUR_POS;
      titulo(ctx, "TERMINASTE…", H / 2 - 260, t * 3, "rgba(243,238,254,0.8)", 42);
      const k = easeOut(clamp01(t * 1.6 - 0.25));
      // cuenta hasta la posición
      const posMostrada = Math.max(1, Math.round(d.pos + (1 - k) * Math.min(8, d.total - d.pos)));
      ctx.save();
      ctx.translate(W / 2, H / 2 + 60); ctx.rotate(-0.05);
      ctx.shadowColor = "#fcd34d"; ctx.shadowBlur = 70 * k;
      ctx.globalAlpha = clamp01(t * 3);
      ctx.textAlign = "center"; ctx.fillStyle = "#fcd34d"; ctx.font = "900 300px system-ui";
      ctx.fillText(posMostrada + "º", 0, 60);
      ctx.restore();
      ctx.globalAlpha = clamp01(t * 2 - 1);
      ctx.textAlign = "center"; ctx.fillStyle = "rgba(243,238,254,0.75)"; ctx.font = "600 32px system-ui";
      ctx.fillText(`de ${d.total} participantes · ${d.fila.pt} puntos`, W / 2, H / 2 + 220);
      ctx.globalAlpha = 1;
      pieFijo(ctx); return;
    }
    // STATS (una a una)
    for (const [emoji, label, valor, color] of stats) {
      if (T < (t0 += DUR_STAT)) {
        const t = (T - (t0 - DUR_STAT)) / DUR_STAT;
        const k = easeOut(clamp01(t * 1.8));
        ctx.save(); ctx.globalAlpha = k;
        ctx.textAlign = "center";
        ctx.font = "120px system-ui"; ctx.fillText(emoji, W / 2, H / 2 - 200);
        ctx.fillStyle = "rgba(243,238,254,0.7)"; ctx.font = "800 36px system-ui";
        ctx.fillText(label, W / 2, H / 2 - 80);
        ctx.translate(W / 2, H / 2 + 110);
        ctx.scale(0.7 + 0.3 * k, 0.7 + 0.3 * k);
        ctx.shadowColor = color; ctx.shadowBlur = 50;
        ctx.fillStyle = color; ctx.font = "900 190px system-ui";
        ctx.fillText(valor, 0, 0);
        ctx.restore();
        pieFijo(ctx); return;
      }
    }
    // TALISMÁN / GAFE
    if (DUR_EXTRA > 0 && T < (t0 += DUR_EXTRA)) {
      const t = (T - (t0 - DUR_EXTRA)) / DUR_EXTRA;
      let y = H / 2 - 60;
      if (d.talisman) {
        titulo(ctx, "🍀 TU TALISMÁN", y - 90, t * 2.5, "#4ade80", 40);
        titulo(ctx, `${d.talisman.equipo} (${d.talisman.pct}%)`, y, t * 2 - 0.3, "#4ade80", 58);
        y += 240;
      }
      if (d.gafe) {
        titulo(ctx, "🐈‍⬛ TU GAFE", y - 90, t * 2 - 0.5, "#fb7185", 40);
        titulo(ctx, `${d.gafe.equipo} (${d.gafe.pct}%)`, y, t * 2 - 0.7, "#fb7185", 58);
      }
      pieFijo(ctx); return;
    }
    // FINAL con confeti
    {
      const t = (T - t0) / DUR_FIN;
      piezas.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.col; ctx.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz * 0.6);
        ctx.restore();
      });
      titulo(ctx, d.jugador, H / 2 - 60, t * 2, "#fff", 84);
      titulo(ctx, `${d.pos}º · ${d.fila.pt} pts`, H / 2 + 60, t * 2 - 0.3, "#fcd34d", 60);
      titulo(ctx, "¡A POR LA PRÓXIMA! 🍀", H / 2 + 180, t * 2 - 0.6, "rgba(243,238,254,0.8)", 36);
      pieFijo(ctx);
    }
  };

  return { cv, ctx, draw, total };
}

// RUTA RÁPIDA: WebCodecs + mp4-muxer (no espera al reloj).
async function videoRapido(temporada, d) {
  const { cv, draw, total } = crearEscena(temporada, d);
  const FPS = 30;
  const frames = Math.ceil(total * FPS);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: cv.width, height: cv.height },
    fastStart: "in-memory",
  });
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { throw e; },
  });
  encoder.configure({
    codec: "avc1.42002A", // H.264 baseline, nivel 4.2 (sobra para 1080×1500@30)
    width: cv.width, height: cv.height,
    bitrate: 5_000_000, framerate: FPS,
  });

  for (let i = 0; i < frames; i++) {
    draw(i / FPS);
    const frame = new VideoFrame(cv, { timestamp: (i * 1e6) / FPS, duration: 1e6 / FPS });
    encoder.encode(frame, { keyFrame: i % 90 === 0 });
    frame.close();
    // no saturar la cola del encoder ni congelar la interfaz
    if (encoder.encodeQueueSize > 6) {
      await new Promise((r) => encoder.addEventListener("dequeue", r, { once: true }));
    } else if (i % 15 === 0) {
      await new Promise((r) => setTimeout(r));
    }
  }
  await encoder.flush();
  muxer.finalize();
  const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
  return { url: URL.createObjectURL(blob), ext: "mp4", metodo: "webcodecs" };
}

// RUTA DE RESPALDO: MediaRecorder en tiempo real.
async function videoLento(temporada, d) {
  const { cv, draw, total } = crearEscena(temporada, d);
  // grabación
  const mime = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
  const stream = cv.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => { rec.onstop = () => res(); });
  rec.start(200);

  const inicio = performance.now();
  await new Promise((res) => {
    const loop = () => {
      const T = (performance.now() - inicio) / 1000;
      if (T >= total) { res(); return; }
      draw(T);
      requestAnimationFrame(loop);
    };
    loop();
  });
  rec.stop();
  await done;
  const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
  const blob = new Blob(chunks, { type: mime.split(";")[0] });
  return { url: URL.createObjectURL(blob), ext, metodo: "mediarecorder" };
}

// Punto de entrada: intenta la rápida y cae a la lenta si no hay soporte.
export async function generarVideoWrapped(temporada, d) {
  if (typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined") {
    try { return await videoRapido(temporada, d); }
    catch (e) { console.warn("WebCodecs falló, usando MediaRecorder:", e); }
  }
  return videoLento(temporada, d);
}
