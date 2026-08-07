// Imágenes de fin de temporada: campeón y rankings por categoría.
// Mismo lenguaje visual (campo + morado) que el resto.

const C = {
  cesped1: "#1e7d3a", cesped2: "#196b32", moradoT: "rgba(26,17,48,0.94)",
  ink: "#f3eefe", muted: "#b9a8d8", accent: "#b794ff",
  gold: "#fcd34d", green: "#4ade80", red: "#fb7185", line: "rgba(183,148,255,0.25)",
};

function nuevoCanvas(W, H) {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  return cv;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fondoCampo(ctx, W, H) {
  const franja = H / 14;
  for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 2 === 0 ? C.cesped1 : C.cesped2; ctx.fillRect(0, i * franja, W, franja); }
  const vg = ctx.createRadialGradient(W / 2, H * 0.32, 200, W / 2, H * 0.5, H);
  vg.addColorStop(0, "rgba(26,17,48,0.12)"); vg.addColorStop(1, "rgba(15,10,32,0.82)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// ===== IMAGEN DE CAMPEÓN =====
export function generarImagenCampeon(temporada, filas) {
  const W = 1080, H = 1350;
  const cv = nuevoCanvas(W, H);
  const ctx = cv.getContext("2d");
  fondoCampo(ctx, W, H);

  const campeon = filas[0];

  // destellos dorados
  ctx.save();
  const halo = ctx.createRadialGradient(W / 2, 420, 50, W / 2, 420, 500);
  halo.addColorStop(0, "rgba(252,211,77,0.25)"); halo.addColorStop(1, "rgba(252,211,77,0)");
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, 900);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = C.accent; ctx.font = "bold 36px system-ui";
  ctx.fillText("TEMPORADA " + temporada.nombre, W / 2, 130);

  ctx.font = "150px system-ui";
  ctx.fillText("🏆", W / 2, 360);

  ctx.fillStyle = C.gold; ctx.font = "bold 40px system-ui";
  ctx.fillText("¡CAMPEÓN!", W / 2, 450);

  ctx.fillStyle = C.ink; ctx.font = "bold 90px system-ui";
  ctx.fillText(campeon.jugador, W / 2, 560);

  ctx.fillStyle = C.gold; ctx.font = "bold 56px system-ui";
  ctx.fillText(`${campeon.pt} puntos`, W / 2, 640);

  // podio (top 3)
  const podio = filas.slice(0, 3);
  const baseY = 1180, anchoCol = 240, gap = 30, startX = (W - (anchoCol * 3 + gap * 2)) / 2;
  const alturas = [320, 230, 170]; // 1º, 2º, 3º
  const orden = [1, 0, 2]; // visual: 2º, 1º, 3º
  orden.forEach((idx, pos) => {
    const p = podio[idx]; if (!p) return;
    const x = startX + pos * (anchoCol + gap);
    const h = alturas[idx];
    ctx.fillStyle = idx === 0 ? "rgba(252,211,77,0.9)" : idx === 1 ? "rgba(183,148,255,0.85)" : "rgba(120,90,200,0.8)";
    rr(ctx, x, baseY - h, anchoCol, h, 14); ctx.fill();
    ctx.fillStyle = "#1a1130"; ctx.font = "bold 60px system-ui"; ctx.textAlign = "center";
    ctx.fillText(idx + 1 + "º", x + anchoCol / 2, baseY - h + 70);
    ctx.fillStyle = "#1a1130"; ctx.font = "bold 30px system-ui";
    ctx.fillText(p.jugador, x + anchoCol / 2, baseY - h + 115);
    ctx.font = "26px system-ui";
    ctx.fillText(`${p.pt} pts`, x + anchoCol / 2, baseY - h + 155);
  });

  return cv.toDataURL("image/png");
}

// ===== CATEGORÍAS =====
export const CATEGORIAS = [
  { key: "ptap", titulo: "PUNTOS POR APUESTA", emoji: "🏅", desc: "Mejor ratio puntos/apuesta", fmt: "ratio" },
  { key: "ap", titulo: "MÁS APUESTAS", emoji: "🎯", desc: "Quien más veces jugó" },
  { key: "d", titulo: "MENOS DERROTAS", emoji: "🛡️", desc: "Quien menos falló", asc: true },
  { key: "pctd", titulo: "MENOS % DERROTAS", emoji: "📉", desc: "Menor porcentaje de fallo", asc: true, fmt: "pct" },
  { key: "e", titulo: "MÁS PUNTOS EXTRA", emoji: "✨", desc: "Aciertos de eliminatoria" },
  { key: "q", titulo: "MÁS QUINIELAS", emoji: "📋", desc: "Más quinielas acertadas" },
  { key: "u", titulo: "MÁS VICTORIAS ÚNICAS", emoji: "💎", desc: "Acertó cuando nadie más" },
  { key: "v", titulo: "MÁS VICTORIAS (NO ÚNICAS)", emoji: "✅", desc: "Más victorias compartidas" },
  { key: "vu", titulo: "MÁS VICTORIAS TOTALES", emoji: "🔥", desc: "Únicas + no únicas" },
  { key: "sdp", titulo: "MÁS SDP", emoji: "🎲", desc: "Mayor suma de SDP" },
];

function ordenarPor(filas, cat) {
  const val = (r) => {
    if (cat.key === "vu") return (r.u || 0) + (r.v || 0);
    if (cat.key === "ptap") return (r.ap || 0) > 0 ? (r.pt || 0) / r.ap : 0;
    if (cat.key === "pctd") return (r.ap || 0) > 0 ? ((r.d || 0) / r.ap) * 100 : 0;
    return r[cat.key] || 0;
  };
  return filas.slice().sort((a, b) => cat.asc ? val(a) - val(b) : val(b) - val(a)).map((r) => ({ ...r, _val: val(r) }));
}

// Formatea el valor según el tipo de categoría
function fmtValor(v, cat) {
  if (cat.fmt === "ratio") return v.toFixed(4).replace(".", ",");
  if (cat.fmt === "pct") return v.toFixed(2).replace(".", ",") + "%";
  return v.toLocaleString("es-ES");
}

// Una imagen para una categoría
export function generarImagenCategoria(temporada, filas, cat) {
  const orden = ordenarPor(filas, cat);
  const W = 1080;
  const rowH = 70, headH = 240;
  const H = headH + orden.length * rowH + 70;
  const cv = nuevoCanvas(W, H);
  const ctx = cv.getContext("2d");
  fondoCampo(ctx, W, H);

  ctx.textAlign = "center";
  ctx.font = "90px system-ui"; ctx.fillText(cat.emoji, W / 2, 110);
  ctx.fillStyle = C.gold; ctx.font = "bold 42px system-ui";
  ctx.fillText(cat.titulo, W / 2, 170);
  ctx.fillStyle = C.muted; ctx.font = "22px system-ui";
  ctx.fillText(`${cat.desc} · Temporada ${temporada.nombre}`, W / 2, 210);

  ctx.fillStyle = C.moradoT; rr(ctx, 40, headH, W - 80, H - headH - 30, 24); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();

  let y = headH + 50;
  orden.forEach((r, i) => {
    if (i === 0) { ctx.fillStyle = "rgba(252,211,77,0.16)"; rr(ctx, 60, y - 34, W - 120, rowH - 8, 10); ctx.fill(); }
    else if (i < 3) { ctx.fillStyle = "rgba(183,148,255,0.08)"; rr(ctx, 60, y - 34, W - 120, rowH - 8, 10); ctx.fill(); }
    ctx.textBaseline = "middle";
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1) + "º";
    ctx.textAlign = "left"; ctx.font = (i < 3 ? "30px" : "bold 24px") + " system-ui";
    ctx.fillStyle = i === 0 ? C.gold : C.muted; ctx.fillText(medal, 85, y);
    ctx.fillStyle = C.ink; ctx.font = "600 30px system-ui"; ctx.fillText(r.jugador, 180, y);
    ctx.textAlign = "right"; ctx.fillStyle = i === 0 ? C.gold : C.accent; ctx.font = "bold 36px system-ui";
    ctx.fillText(fmtValor(r._val, cat), W - 85, y);
    ctx.textBaseline = "alphabetic";
    y += rowH;
  });

  return cv.toDataURL("image/png");
}

// Una sola imagen larga con las 8 categorías (top 3 de cada una)
export function generarImagenTodasCategorias(temporada, filas) {
  const W = 1080;
  const catH = 300;
  const H = 200 + CATEGORIAS.length * catH + 40;
  const cv = nuevoCanvas(W, H);
  const ctx = cv.getContext("2d");
  fondoCampo(ctx, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = C.gold; ctx.font = "bold 48px system-ui";
  ctx.fillText("PALMARÉS DE LA TEMPORADA", W / 2, 90);
  ctx.fillStyle = C.accent; ctx.font = "bold 32px system-ui";
  ctx.fillText(temporada.nombre, W / 2, 140);

  let y = 200;
  CATEGORIAS.forEach((cat) => {
    const orden = ordenarPor(filas, cat).slice(0, 3);
    ctx.fillStyle = C.moradoT; rr(ctx, 40, y, W - 80, catH - 20, 18); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();

    ctx.textAlign = "left"; ctx.fillStyle = C.gold; ctx.font = "bold 30px system-ui";
    ctx.fillText(`${cat.emoji} ${cat.titulo}`, 70, y + 50);

    let ry = y + 110;
    orden.forEach((r, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      ctx.textAlign = "left"; ctx.font = "26px system-ui"; ctx.fillStyle = C.ink;
      ctx.fillText(`${medal}  ${r.jugador}`, 90, ry);
      ctx.textAlign = "right"; ctx.fillStyle = i === 0 ? C.gold : C.accent; ctx.font = "bold 28px system-ui";
      ctx.fillText(fmtValor(r._val, cat), W - 90, ry);
      ry += 56;
    });
    y += catH;
  });

  return cv.toDataURL("image/png");
}

// ===== WRAPPED POR JUGADOR (estilo neón) =====
// datos: { jugador, pos, total, fila (ap,d,e,q,u,v,sdp,pt), titulos, rachaMax, talisman, gafe }
export function generarImagenWrapped(temporada, datos) {
  const W = 1080, H = 1680;
  const cv = nuevoCanvas(W, H);
  const ctx = cv.getContext("2d");

  // fondo oscuro con manchas de neón
  ctx.fillStyle = "#0d0820"; ctx.fillRect(0, 0, W, H);
  const mancha = (x, y, r, col) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  };
  mancha(W * 0.15, H * 0.1, 600, "rgba(124,92,240,0.4)");
  mancha(W * 0.9, H * 0.35, 550, "rgba(244,114,182,0.3)");
  mancha(W * 0.2, H * 0.85, 600, "rgba(252,211,77,0.18)");
  mancha(W * 0.85, H * 0.95, 450, "rgba(34,211,238,0.2)");

  // banda diagonal de rayas
  ctx.save();
  ctx.translate(W / 2, 330); ctx.rotate(-0.06);
  for (let i = -8; i < 9; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(183,148,255,0.08)" : "rgba(0,0,0,0)";
    ctx.fillRect(-W, i * 38, W * 2, 38);
  }
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillStyle = "#b794ff"; ctx.font = "800 26px system-ui";
  ctx.fillText("· MI TEMPORADA " + temporada.nombre + " ·", W / 2, 90);

  // nombre con degradado
  const gradN = ctx.createLinearGradient(W * 0.2, 0, W * 0.8, 0);
  gradN.addColorStop(0, "#ffffff"); gradN.addColorStop(1, "#b794ff");
  ctx.fillStyle = gradN; ctx.font = "900 80px system-ui";
  ctx.fillText(datos.jugador, W / 2, 195);
  if (datos.titulos > 0) {
    ctx.font = "34px system-ui";
    ctx.fillText("⭐".repeat(Math.min(datos.titulos, 5)), W / 2, 245);
  }

  // posición GIGANTE inclinada con brillo
  ctx.save();
  ctx.translate(W / 2, 470); ctx.rotate(-0.05);
  ctx.shadowColor = "#fcd34d"; ctx.shadowBlur = 60;
  ctx.fillStyle = "#fcd34d"; ctx.font = "900 260px system-ui";
  ctx.fillText(datos.pos + "º", 0, 60);
  ctx.restore();
  ctx.fillStyle = "rgba(243,238,254,0.75)"; ctx.font = "600 26px system-ui";
  ctx.fillText(`de ${datos.total} participantes  ·  ${datos.fila.pt} puntos`, W / 2, 610);

  // tarjetas inclinadas alternando
  const tarjetas = [
    ["🎯", "APUESTAS", String(datos.fila.ap), "#b794ff"],
    ["✅", "VICTORIAS", String((datos.fila.v || 0) + (datos.fila.u || 0)), "#4ade80"],
    ["💎", "ÚNICAS", String(datos.fila.u || 0), "#fcd34d"],
    ["📋", "QUINIELAS", String(datos.fila.q || 0), "#22d3ee"],
    ["🔥", "MEJOR RACHA", datos.rachaMax > 0 ? `${datos.rachaMax}` : "—", "#fb7185"],
    ["🏆", "RACHA VICTORIAS", datos.rachaVictoriasMax > 0 ? `${datos.rachaVictoriasMax}` : "—", "#a3e635"],
    ["💜", "TU FAVORITO", datos.resultadoFavorito || "—", "#c084fc"],
    datos.resultadoGanador
      ? ["🎯", "MÁS GANADOR", datos.resultadoGanador, "#fbbf24"]
      : ["🎲", "SDP", (datos.fila.sdp || 0).toLocaleString("es-ES"), "#f472b6"],
  ];
  const colW = (W - 140) / 2, cardH = 150;
  tarjetas.forEach((t, i) => {
    const cx = 70 + (i % 2) * (colW + 20), cy = 680 + Math.floor(i / 2) * (cardH + 24);
    ctx.save();
    ctx.translate(cx + colW / 2 - 10, cy + cardH / 2);
    ctx.rotate(i % 2 === 0 ? -0.018 : 0.018);
    ctx.fillStyle = "rgba(20,12,40,0.85)";
    rr(ctx, -colW / 2 + 10, -cardH / 2, colW - 20, cardH, 22); ctx.fill();
    ctx.strokeStyle = t[3]; ctx.lineWidth = 2.5;
    ctx.shadowColor = t[3]; ctx.shadowBlur = 18; ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
    ctx.font = "46px system-ui"; ctx.fillText(t[0], -colW / 2 + 36, 18);
    ctx.fillStyle = "rgba(243,238,254,0.6)"; ctx.font = "800 17px system-ui";
    ctx.fillText(t[1], -colW / 2 + 110, -16);
    ctx.fillStyle = t[3]; ctx.font = "900 48px system-ui";
    ctx.fillText(t[2], -colW / 2 + 110, 34);
    ctx.restore();
  });

  // talismán y gafe como píldoras
  let yy = 680 + Math.ceil(tarjetas.length / 2) * (cardH + 24) + 30;
  ctx.textAlign = "center";
  const pildora = (texto, col) => {
    ctx.font = "700 26px system-ui";
    const w = ctx.measureText(texto).width + 60;
    ctx.fillStyle = "rgba(20,12,40,0.85)";
    rr(ctx, W / 2 - w / 2, yy - 32, w, 50, 25); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = col; ctx.fillText(texto, W / 2, yy + 2);
    yy += 70;
  };
  if (datos.talisman) pildora(`🍀 Talismán: ${datos.talisman.equipo} (${datos.talisman.pct}%)`, "#4ade80");
  if (datos.gafe) pildora(`🐈‍⬛ Gafe: ${datos.gafe.equipo} (${datos.gafe.pct}%)`, "#fb7185");

  ctx.fillStyle = "rgba(183,148,255,0.6)"; ctx.font = "800 20px system-ui";
  ctx.fillText("LA HOJA DE MIS APUESTAS", W / 2, H - 50);

  return cv.toDataURL("image/png");
}

// ===== RESUMEN DE TEMPORADA: panel de totales + cajetín de récords =====
// totales: objeto de getTotalesTemporada. records: array de getRecordsHistoricos.
export function generarImagenResumenTemporada(temporada, totales, records = []) {
  const W = 1080, H = 1350;
  const cv = nuevoCanvas(W, H);
  const ctx = cv.getContext("2d");
  fondoCampo(ctx, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = C.accent; ctx.font = "bold 34px system-ui";
  ctx.fillText("RESUMEN · TEMPORADA " + temporada.nombre, W / 2, 90);
  ctx.fillStyle = C.gold; ctx.font = "bold 30px system-ui";
  ctx.fillText("🏆 " + totales.campeon, W / 2, 140);

  // ---- panel de totales (rejilla de cifras grandes) ----
  const datos = [
    ["UN CAMPEÓN", totales.campeon, C.gold],
    [`${totales.lideres} ${totales.lideres === 1 ? "LÍDER" : "LÍDERES"}`, "", C.accent],
    [`${totales.porras} PORRAS`, "", C.ink],
    [`${totales.jugadores} JUGADORES`, "", C.ink],
    [`${totales.victorias} VICTORIAS`, "totales", C.green],
    [`${totales.unicas} VICTORIAS ÚNICAS`, "", C.gold],
    [`${totales.quinielas} QUINIELAS`, "", C.ink],
    [`${totales.extras} PUNTOS EXTRA`, "", C.ink],
    [`${totales.derrotas} DERROTAS`, "", C.red],
    [`${totales.puntos.toLocaleString("es-ES")} PUNTOS`, "", C.ink],
    [`${totales.apuestas.toLocaleString("es-ES")} APUESTAS`, "", C.ink],
    [`${totales.sdp.toLocaleString("es-ES")} SDP`, "", C.muted],
  ];
  let py = 200;
  const panelH = 600;
  ctx.fillStyle = C.moradoT; rr(ctx, 40, py, W - 80, panelH, 22); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
  const filas = Math.ceil(datos.length / 2);
  const cellW = (W - 80) / 2, cellH = panelH / filas;
  datos.forEach((d, i) => {
    const cx = 40 + (i % 2) * cellW + cellW / 2;
    const cy = py + Math.floor(i / 2) * cellH + cellH / 2;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = d[2]; ctx.font = "bold 34px system-ui";
    ctx.fillText(d[0], cx, cy - (d[1] ? 12 : 0));
    if (d[1]) { ctx.fillStyle = C.muted; ctx.font = "18px system-ui"; ctx.fillText(d[1], cx, cy + 20); }
    ctx.textBaseline = "alphabetic";
  });

  // ---- cajetín de récords históricos ----
  let ry = py + panelH + 40;
  ctx.textAlign = "left";
  ctx.fillStyle = C.gold; ctx.font = "bold 28px system-ui";
  ctx.fillText("📜 RÉCORDS HISTÓRICOS", 60, ry);
  ry += 20;
  const cajH = H - ry - 60;
  ctx.fillStyle = C.moradoT; rr(ctx, 40, ry, W - 80, cajH, 18); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
  let ly = ry + 50;
  records.slice(0, 6).forEach((r) => {
    ctx.fillStyle = r.esActual ? C.green : C.ink;
    ctx.font = (r.esActual ? "bold " : "") + "23px system-ui";
    ctx.fillText((r.esActual ? "🔥 " : "• ") + r.texto, 70, ly);
    ly += 46;
  });

  ctx.textAlign = "center"; ctx.fillStyle = C.muted; ctx.font = "18px system-ui";
  ctx.fillText("La Hoja De Mis Apuestas", W / 2, H - 25);

  return cv.toDataURL("image/png");
}
