// Genera una imagen promocional (canvas) para una porra de partido.
// Estética morada del grupo. Escudos opcionales (si hay URL).
// Devuelve un dataURL PNG. Maneja CORS de las imágenes de Supabase.

import { P, lienzo, glowText, chip, panel, franjaDiagonal, escudoConHalo, lineaNeon, rr } from "./estiloImagen.js";

const COL = { bg: "#3a2a5d", panel: "#2f2150", ink: "#f4eefe", accent: "#c9b3ff", gold: "#ffd166", line: "#6a4fa0" };

function cargarImg(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // si falla, seguimos sin escudo
    img.src = url;
  });
}

function dibujarEscudo(ctx, img, cx, cy, size, fallbackText) {
  if (img) {
    // encajar manteniendo proporción dentro de size x size
    const r = Math.min(size / img.width, size / img.height);
    const w = img.width * r, h = img.height * r;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  } else {
    // emblema de respaldo: círculo con iniciales
    ctx.fillStyle = COL.panel;
    ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COL.line; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = COL.accent;
    ctx.font = `bold ${size * 0.32}px Arial`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const ini = fallbackText.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
    ctx.fillText(ini, cx, cy);
  }
}

function texto(ctx, t, x, y, font, color, align = "center") {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = "middle";
  ctx.fillText(t, x, y);
}

export async function generarPromo(porra, equipoLocal, equipoVisitante) {
  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  lienzo(ctx, W, H);

  // Cabecera: marca + logo
  const logo = await cargarImg("/logo.png");
  if (logo) {
    const altoLogo = 104;
    const anchoLogo = logo.width * (altoLogo / logo.height);
    ctx.save(); ctx.globalAlpha = 0.97;
    ctx.drawImage(logo, 40, 24, anchoLogo, altoLogo);
    ctx.restore();
  }
  glowText(ctx, "LA HOJA DE MIS APUESTAS", W / 2, 66, "900 34px system-ui", P.ink, 14);

  const cab = [
    (porra.comp || "").toUpperCase(),
    porra.jornada_camp ? String(porra.jornada_camp).toUpperCase() : null,
  ].filter(Boolean).join(" · ");
  if (cab) chip(ctx, cab, W / 2, 140, "bold 30px system-ui", P.lila);

  glowText(ctx, porra.jornada != null ? `PORRA ${porra.jornada}` : (porra.sede || "PORRA ESPECIAL").toUpperCase(),
    W / 2, 236, "900 104px system-ui", P.ink, 20);

  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (porra.sede && porra.jornada != null) {
    ctx.font = "bold 34px system-ui"; ctx.fillStyle = P.lila;
    ctx.fillText(porra.sede.toUpperCase(), W / 2, 300);
  }
  // fecha y hora del partido
  if (porra.cierra_en) {
    const f = new Date(porra.cierra_en);
    const dd = String(f.getDate()).padStart(2, "0"), mmes = String(f.getMonth() + 1).padStart(2, "0");
    const hh = String(f.getHours()).padStart(2, "0"), mi = String(f.getMinutes()).padStart(2, "0");
    ctx.font = "bold 30px system-ui"; ctx.fillStyle = P.dorado;
    ctx.fillText(`${dd}/${mmes} · ${hh}:${mi} H`, W / 2, 350);
  }
  ctx.restore();

  // Escudos protagonistas
  franjaDiagonal(ctx, W, 500, 300, "rgba(168,85,247,0.10)");
  const [imgL, imgV] = await Promise.all([
    cargarImg(equipoLocal?.escudo_url),
    cargarImg(equipoVisitante?.escudo_url),
  ]);
  const cy = 660, size = 300;
  escudoConHalo(ctx, imgL, W * 0.28, cy, size, "rgb(168,85,247)", porra.local || "L");
  escudoConHalo(ctx, imgV, W * 0.72, cy, size, "rgb(34,211,238)", porra.visitante || "V");
  glowText(ctx, "VS", W / 2, cy, "900 78px system-ui", P.dorado, 22);

  // Nombres
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 48px system-ui"; ctx.fillStyle = "#FFFFFF";
  ctx.fillText((porra.local || "").toUpperCase(), W * 0.28, cy + 210);
  ctx.fillText((porra.visitante || "").toUpperCase(), W * 0.72, cy + 210);
  ctx.restore();

  lineaNeon(ctx, 140, W - 140, 940, P.morado);

  // Llamada a la acción
  glowText(ctx, "¿CUÁL ES TU PRONÓSTICO?", W / 2, 1030, "900 54px system-ui", "#FFFFFF", 14);
  if (porra.eliminatoria) {
    chip(ctx, "ELIMINATORIA · PUNTO EXTRA AL PASE", W / 2, 1112, "bold 28px system-ui", P.rosa);
  } else if (porra.cierra_en) {
    const f = new Date(porra.cierra_en);
    const hh = String(f.getHours()).padStart(2, "0"), mm = String(f.getMinutes()).padStart(2, "0");
    chip(ctx, `CIERRA A LAS ${hh}:${mm}`, W / 2, 1112, "bold 30px system-ui", P.dorado);
  }

  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "26px system-ui"; ctx.fillStyle = P.gris;
  ctx.fillText("VOTA EN", W / 2, 1190);
  ctx.restore();
  glowText(ctx, "la-hoja-de-mis-apuestas.vercel.app", W / 2, 1235, "bold 32px system-ui", P.verde, 12);

  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 24px system-ui"; ctx.fillStyle = P.tenue;
  ctx.fillText("LA HOJA DE MIS APUESTAS", W / 2, H - 42);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

export function descargarDataUrl(dataUrl, nombre) {
  const a = document.createElement("a");
  a.href = dataUrl; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
}

// Presentación de una porra ESPECIAL (para WhatsApp). Si hay resultado real,
// lo muestra arriba como "resultado". Usa cabecera si la porra la tiene.
export async function generarPromoEspecial(porra) {
  const W = 1080, H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COL.bg); g.addColorStop(1, COL.panel);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // Imagen de cabecera de fondo (si la hay), con velo oscuro
  const cab = await cargarImg(porra.cabecera_url);
  if (cab) {
    const ratio = Math.max(W / cab.width, H / cab.height);
    const w = cab.width * ratio, h = cab.height * ratio;
    ctx.drawImage(cab, (W - w) / 2, (H - h) / 2, w, h);
    ctx.fillStyle = "rgba(26,17,48,0.66)"; ctx.fillRect(0, 0, W, H);
  }
  ctx.strokeStyle = COL.line; ctx.lineWidth = 8; ctx.strokeRect(24, 24, W - 48, H - 48);

  texto(ctx, `PORRA ${porra.jornada}`, W / 2, 130, "bold 56px Arial", COL.accent);
  texto(ctx, (porra.comp || "").toUpperCase(), W / 2, 195, "28px Arial", COL.ink);

  // Título de la porra (su predicción), partido en líneas
  const titulo = porra.sede || porra.titulo || "PORRA ESPECIAL";
  ctx.font = "bold 54px Arial"; ctx.fillStyle = COL.gold; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const maxW = W - 160;
  const words = titulo.split(" "); const lineas = []; let line = "";
  for (const w of words) { const t = line + w + " "; if (ctx.measureText(t).width > maxW && line) { lineas.push(line.trim()); line = w + " "; } else line = t; }
  lineas.push(line.trim());
  let ty = 420 - (lineas.length - 1) * 35;
  lineas.forEach((ln) => { ctx.fillText(ln, W / 2, ty); ty += 70; });

  // Resultado real arriba como presentación, si ya está resuelta
  const real = porra.resultado;
  if (real) {
    const pred = (porra.predicciones || [])[0];
    const p = typeof pred === "string" ? { tipo: "opcion", puestos: [] } : (pred || {});
    let txtReal = "";
    const r0 = Array.isArray(real) ? real[0] : (real.premio !== undefined ? real.premio : real[0]);
    if (porra.modo === "aproximacion") txtReal = `Terminación: ${String(real.premio ?? "").slice(-1)}`;
    else if (p.tipo === "equipo_puesto" && Array.isArray(r0)) txtReal = (p.puestos || []).map((pu, s) => `${pu} ${r0[s] || "—"}`).join("   ");
    else if (r0 != null && typeof r0 === "object") {
      txtReal = `Resultado: ${r0.exacto ?? ""}`;
      if (r0.aprox) txtReal += ` / 2º: ${r0.aprox}`;
    }
    else txtReal = `Resultado: ${r0 ?? ""}`;
    texto(ctx, "✅ RESULTADO", W / 2, ty + 20, "bold 30px Arial", COL.accent);
    ctx.font = "bold 40px Arial"; ctx.fillStyle = COL.ink;
    const rw = txtReal.split(" "); const rl = []; let rline = "";
    for (const w of rw) { const t = rline + w + " "; if (ctx.measureText(t).width > maxW && rline) { rl.push(rline.trim()); rline = w + " "; } else rline = t; }
    rl.push(rline.trim());
    let ry = ty + 80; rl.forEach((ln) => { ctx.fillText(ln, W / 2, ry); ry += 50; });
  }

  if (!real) texto(ctx, "¡VOTA YA!", W / 2, H - 120, "bold 48px Arial", COL.accent);
  return canvas.toDataURL("image/png");
}
