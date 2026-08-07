import { getEquipo } from "./equipos.js";
import { P, lienzo, glowText, chip, panel, franjaDiagonal, escudoConHalo, lineaNeon, recortar, envolver } from "./estiloImagen.js";

// Genera una imagen PNG de resultados: marcador sobre estadio nocturno
// (dibujado por código) + escudos reales + clasificación completa.
// Devuelve dataURL. Pensada para compartir por WhatsApp (1080x1620).

const C = {
  cesped1: "#1e7d3a", cesped2: "#196b32",
  moradoT: "rgba(26,17,48,0.92)",
  ink: "#f3eefe", muted: "#b9a8d8", accent: "#b794ff",
  gold: "#fcd34d", green: "#4ade80", red: "#fb7185", line: "rgba(183,148,255,0.25)",
};

function cargarImg(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function generarImagenResultados(porra, filas) {
  const ROW = 58;
  const W = 1080;
  const H = 816 + filas.length * ROW + 110;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");

  lienzo(ctx, W, H);

  const esPartido = porra.tipo === "partido";
  let imgL = null, imgV = null;
  if (esPartido) {
    const [eqL, eqV] = await Promise.all([getEquipo(porra.local), getEquipo(porra.visitante)]);
    [imgL, imgV] = await Promise.all([cargarImg(eqL?.escudo_url), cargarImg(eqV?.escudo_url)]);
  }

  // ===== Cabecera: marca + logo =====
  const logo = await cargarImg("/logo.png");
  if (logo) {
    // se dibuja manteniendo su proporción, sin deformarlo
    const altoLogo = 104;
    const anchoLogo = logo.width * (altoLogo / logo.height);
    ctx.save();
    ctx.globalAlpha = 0.97;
    ctx.drawImage(logo, 40, 24, anchoLogo, altoLogo);
    ctx.restore();
  }
  glowText(ctx, "LA HOJA DE MIS APUESTAS", W / 2, 66, "900 34px system-ui", P.ink, 14);

  const cab = [
    porra.jornada != null ? `PORRA ${porra.jornada}` : "ESPECIAL",
    (porra.comp || "").toUpperCase(),
    porra.jornada_camp ? String(porra.jornada_camp).toUpperCase() : null,
  ].filter(Boolean).join(" · ");
  chip(ctx, cab, W / 2, 132, "bold 28px system-ui", P.lila);

  if (porra.sede && porra.tipo === "partido") {
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 26px system-ui"; ctx.fillStyle = P.lila;
    ctx.fillText(recortar(ctx, porra.sede.toUpperCase(), W - 160), W / 2, 180);
    ctx.restore();
  }

  franjaDiagonal(ctx, W, 205, 300, "rgba(168,85,247,0.09)", 60);

  if (esPartido) {
    escudoConHalo(ctx, imgL, 200, 336, 190, "rgb(168,85,247)", porra.local || "L");
    escudoConHalo(ctx, imgV, 880, 336, 190, "rgb(34,211,238)", porra.visitante || "V");
    const rl = porra.resultado?.local ?? "", rv = porra.resultado?.visitante ?? "";
    glowText(ctx, `${rl} - ${rv}`, W / 2, 324, "900 150px system-ui", "#FFFFFF", 26);
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = "bold 34px system-ui"; ctx.fillStyle = "#FFFFFF";
    ctx.fillText(recortar(ctx, (porra.local || "").toUpperCase(), 330), 200, 466);
    ctx.fillText(recortar(ctx, (porra.visitante || "").toUpperCase(), 330), 880, 466);
    if (porra.resultado_final) {
      ctx.font = "bold 26px system-ui"; ctx.fillStyle = P.dorado;
      ctx.fillText(porra.resultado_final.toUpperCase(), W / 2, 412);
    }
    ctx.restore();
  } else {
    // Especial: pregunta y respuesta juntas ("CAMPEÓN: ESPAÑA")
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const maxW = W - 140;
    const pred = (porra.predicciones || [])[0];
    const pr = typeof pred === "string" ? { tipo: "opcion", puestos: [] } : (pred || {});
    const real = porra.resultado;
    const r0 = real == null ? null : (Array.isArray(real) ? real[0] : (real.premio !== undefined ? real.premio : real[0]));

    // --- extracción robusta del resultado ---
    const nombresDe = (x) => {
      if (x == null) return [];
      if (Array.isArray(x)) return x.flatMap(nombresDe);
      if (typeof x === "object") return [];
      const t = String(x).trim();
      return t ? [t] : [];
    };
    let aciertos = [], aprox = null;
    if (real != null) {
      if (porra.modo === "aproximacion") {
        aciertos = [String(real?.premio ?? r0 ?? "").slice(-1)];
      } else {
        const esObj = r0 != null && !Array.isArray(r0) && typeof r0 === "object";
        aciertos = esObj ? nombresDe(r0.lista ?? r0.exacto ?? r0.valor ?? r0.resultado) : nombresDe(r0);
        if (aciertos.length === 0 && esObj) {
          aciertos = Object.entries(r0).filter(([k]) => k !== "aprox" && k !== "aproximacion")
            .flatMap(([, v]) => nombresDe(v));
        }
        aprox = esObj ? (nombresDe(r0.aprox ?? r0.aproximacion)[0] || null) : null;
      }
    }

    const puestos = pr.puestos || [];
    const tituloPorra = (porra.sede || porra.comp || "PORRA ESPECIAL").toUpperCase();
    // Etiqueta de la aproximación: configurable por porra (p. ej. "Subcampeón")
    const etqAprox = (pr.etiqueta_aprox || "Aprox").toUpperCase();

    let y = 246;
    if (aciertos.length === 0) {
      // sin resolver: solo la pregunta
      glowText(ctx, tituloPorra, W / 2, y + 40, "900 60px system-ui", P.ink, 18);
    } else if (aciertos.length === 1) {
      // una sola respuesta: "PREGUNTA: RESPUESTA" en una línea si cabe
      const etq = (puestos[0] || tituloPorra).toUpperCase();
      const full = `${etq}: ${aciertos[0].toUpperCase()}`;
      ctx.font = "900 62px system-ui";
      if (ctx.measureText(full).width <= maxW) {
        glowText(ctx, full, W / 2, y + 46, "900 62px system-ui", "#FFFFFF", 18);
      } else {
        ctx.font = "bold 40px system-ui"; ctx.fillStyle = P.lila;
        ctx.fillText(etq, W / 2, y + 10);
        glowText(ctx, aciertos[0].toUpperCase(), W / 2, y + 74, "900 62px system-ui", "#FFFFFF", 18);
      }
      y += 46;
    } else {
      // varias respuestas: título arriba y una línea por puesto
      ctx.font = "bold 40px system-ui"; ctx.fillStyle = P.lila;
      ctx.fillText(tituloPorra, W / 2, y);
      y += 18;
      const paso = aciertos.length > 3 ? 46 : 56;
      aciertos.forEach((eq, i2) => {
        const etq = (puestos[i2] || `${i2 + 1}º`).toUpperCase();
        y += paso;
        glowText(ctx, `${etq}: ${eq.toUpperCase()}`, W / 2, y,
          `900 ${aciertos.length > 3 ? 38 : 46}px system-ui`, "#FFFFFF", 14);
      });
    }
    // aproximación, con su etiqueta
    if (aprox) {
      glowText(ctx, `${etqAprox}: ${aprox.toUpperCase()}`, W / 2, y + 66, "bold 40px system-ui", P.dorado, 14);
    }
    ctx.restore();
  }

  // ===== Titular (se reparte en varias líneas y el panel crece) =====
  let yTabla = 664;
  if (porra.comentarios || porra.subcomentario) {
    const maxW = W - 170;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";

    // titular: hasta 2 líneas, encogiendo la letra si hace falta
    let fTit = 38;
    ctx.font = `bold ${fTit}px system-ui`;
    let lTit = porra.comentarios ? envolver(ctx, porra.comentarios, maxW, 2) : [];
    while (lTit.length > 1 && fTit > 30) {
      fTit -= 2; ctx.font = `bold ${fTit}px system-ui`;
      lTit = envolver(ctx, porra.comentarios, maxW, 2);
    }
    // subcomentario: hasta 3 líneas
    ctx.font = "26px system-ui";
    const lSub = porra.subcomentario ? envolver(ctx, porra.subcomentario, maxW, 3) : [];

    const hTit = lTit.length * (fTit + 8);
    const hSub = lSub.length * 34;
    const alto = Math.max(96, 34 + hTit + (lSub.length ? 10 + hSub : 0));
    const yPanel = 500;
    panel(ctx, 56, yPanel, W - 112, alto, 20, "rgba(12,6,30,0.80)", P.dorado, "rgba(252,211,77,0.6)", 2);

    let ty = yPanel + 26 + fTit / 2;
    ctx.fillStyle = "#FFFFFF"; ctx.font = `bold ${fTit}px system-ui`;
    lTit.forEach((l) => { ctx.fillText(l, W / 2, ty); ty += fTit + 8; });
    if (lSub.length) {
      ty += 4;
      ctx.font = "26px system-ui"; ctx.fillStyle = "#FFFFFF";
      lSub.forEach((l) => { ctx.fillText(l, W / 2, ty); ty += 34; });
    }
    ctx.restore();
    yTabla = yPanel + alto + 46;
  }

  // ===== Cabecera de columnas =====
  const X_MOV = 96, X_POS = 148, X_NOM = 186;
  const COLS = [
    ["P", 436, 54], ["AP", 492, 58], ["D", 550, 54], ["E", 604, 54],
    ["Q", 658, 54], ["U", 712, 54], ["V", 766, 54], ["SDP", 862, 138], ["PT", 978, 92],
  ];
  const hy = yTabla;
  ctx.save();
  ctx.textBaseline = "middle";
  ctx.font = "bold 19px system-ui";
  ctx.textAlign = "left"; ctx.fillStyle = P.lila;
  ctx.fillText("CLASIFICACIÓN", X_NOM, hy);
  ctx.textAlign = "center";
  const COLOR_COL = { P: P.verde, AP: P.lila, D: "#F47185", E: "#FB923C", Q: "#FCD34D", U: "#C4A9FF", V: "#34D399", SDP: P.dorado, PT: P.dorado };
  COLS.forEach(([lbl, cx]) => {
    ctx.fillStyle = COLOR_COL[lbl] || P.lila;
    ctx.fillText(lbl, cx, hy);
  });
  ctx.restore();
  lineaNeon(ctx, 56, W - 56, hy + 18, P.morado);

  // ===== Filas =====
  const y0 = yTabla + 32;
  filas.forEach((f, i) => {
    const lider = i === 0;
    const fy = y0 + i * ROW;
    const alto = ROW - 7;
    if (lider) {
      panel(ctx, 56, fy, W - 112, alto, 13, "rgba(92,62,16,0.62)", P.dorado, "rgba(252,211,77,0.65)", 2);
    } else {
      panel(ctx, 56, fy, W - 112, alto, 13,
        i % 2 === 0 ? "rgba(255,255,255,0.078)" : "rgba(255,255,255,0.039)",
        "rgba(255,255,255,0.10)", null, 1);
    }
    const midy = fy + alto / 2;
    ctx.save();
    ctx.textBaseline = "middle";

    // movimiento
    if (typeof f.mov === "number") {
      ctx.textAlign = "center"; ctx.font = "bold 17px system-ui";
      if (f.mov > 0) { ctx.fillStyle = P.verde; ctx.fillText(`▲${f.mov}`, X_MOV, midy); }
      else if (f.mov < 0) { ctx.fillStyle = "#F47185"; ctx.fillText(`▼${Math.abs(f.mov)}`, X_MOV, midy); }
      else { ctx.fillStyle = "rgba(185,168,216,0.5)"; ctx.fillText("=", X_MOV, midy); }
    }
    // posición
    ctx.textAlign = "center"; ctx.font = "bold 28px system-ui";
    ctx.fillStyle = lider ? P.dorado : P.ink;
    ctx.fillText(String(i + 1), X_POS, midy);

    // nombre + estrellas + corona
    ctx.textAlign = "left"; ctx.font = "bold 25px system-ui"; ctx.fillStyle = P.ink;
    const anchoEstrellas = (f.titulos > 0 ? f.titulos * 14 + 10 : 0);
    const disponible = 436 - 27 - X_NOM - anchoEstrellas - 10;
    const nombre = recortar(ctx, f.jugador, disponible);
    ctx.fillText(nombre, X_NOM, midy);
    let nx = X_NOM + ctx.measureText(nombre).width + 8;
    if (f.titulos > 0) {
      ctx.font = "14px system-ui"; ctx.fillStyle = P.dorado;
      ctx.fillText("★".repeat(Math.min(f.titulos, 5)), nx, midy - 1);
      nx += anchoEstrellas;
    }
    // columnas numéricas
    ctx.textAlign = "center";
    const vals = {
      P: f.ptJornada || 0, AP: f.ap || 0, D: f.d || 0, E: f.e || 0,
      Q: f.q || 0, U: f.u || 0, V: f.v || 0, SDP: f.sdp || 0, PT: f.pt || 0,
    };
    COLS.forEach(([lbl, cx]) => {
      const val = vals[lbl];
      if (lbl === "P") {
        ctx.font = "bold 23px system-ui";
        ctx.fillStyle = val > 0 ? P.verde : "rgba(160,148,200,0.55)";
        ctx.fillText(val > 0 ? `+${val}` : "0", cx, midy);
      } else if (lbl === "SDP") {
        ctx.font = "bold 23px system-ui"; ctx.fillStyle = "#BEB2E1";
        ctx.fillText(val.toLocaleString("es-ES"), cx, midy);
      } else if (lbl === "PT") {
        ctx.font = "bold 34px system-ui"; ctx.fillStyle = lider ? P.dorado : P.ink;
        ctx.fillText(String(val), cx, midy);
      } else {
        // Cada columna con su color para distinguirlas de un vistazo
        const colorCol = {
          AP: "#CDC4EB",       // neutro
          D: "#F47185",        // rojo
          E: "#FB923C",        // naranja
          Q: "#FCD34D",        // amarillo
          U: "#C4A9FF",        // morado
          V: "#34D399",        // verde
        }[lbl] || "#CDC4EB";
        ctx.font = "bold 23px system-ui"; ctx.fillStyle = colorCol;
        ctx.fillText(String(val), cx, midy);
      }
    });
    ctx.restore();
  });

  // pie
  ctx.save();
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "bold 22px system-ui"; ctx.fillStyle = P.tenue;
  ctx.fillText("LA HOJA DE MIS APUESTAS", W / 2, H - 52);
  ctx.restore();

  return cv.toDataURL("image/png");
}

export async function generarImagenVotos(porra, votos, aciertos = null) {
  const W = 1080;
  const filas = (votos || []).slice().sort((a, b) => a.jugador.localeCompare(b.jugador, "es"));
  const headH = 280;
  const rowH = 64;
  const H = Math.max(700, headH + 120 + filas.length * rowH + 60);

  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };

  // fondo campo
  const franja = H / Math.max(8, Math.round(H / 116));
  for (let i = 0; i < Math.ceil(H / franja); i++) { ctx.fillStyle = i % 2 === 0 ? C.cesped1 : C.cesped2; ctx.fillRect(0, i * franja, W, franja); }
  const vg = ctx.createRadialGradient(W / 2, H * 0.3, 200, W / 2, H * 0.5, H);
  vg.addColorStop(0, "rgba(26,17,48,0.15)"); vg.addColorStop(1, "rgba(15,10,32,0.8)");
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // cabecera
  ctx.fillStyle = C.moradoT; rr(40, 50, W - 80, headH - 40, 24); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = C.accent; ctx.font = "bold 30px system-ui";
  ctx.fillText("PORRA " + porra.jornada + " — VOTOS", W / 2, 110);
  ctx.fillStyle = C.ink; ctx.font = "600 24px system-ui";
  ctx.fillText((porra.comp || "").toUpperCase(), W / 2, 150);
  if (porra.tipo === "partido") {
    ctx.fillStyle = C.gold; ctx.font = "bold 30px system-ui";
    ctx.fillText(`${porra.local}  vs  ${porra.visitante}`, W / 2, 200);
  }
  ctx.fillStyle = C.muted; ctx.font = "18px system-ui";
  ctx.fillText(aciertos ? "Así votó cada uno · ✓ puntuó, ✗ no" : "Votación cerrada · resultado pendiente", W / 2, 240);

  // lista de votos
  const formatVoto = (v) => {
    const c = v.contenido || {};
    if (porra.tipo === "partido") return `${c.local} - ${c.visitante}` + (c.pasa ? ` · pasa ${c.pasa}` : "");
    if (porra.modo === "aproximacion") return `Term. ${c.digito}`;
    const preds = (porra.predicciones || []).map((p) => typeof p === "string" ? { tipo: "opcion" } : p);
    return (c.resp || []).map((r, i) => {
      const p = preds[i] || { tipo: "opcion" };
      if (p.tipo === "equipo_puesto" && Array.isArray(r)) return (p.puestos || []).map((pu, s2) => `${pu} ${r[s2] || "—"}`).join(", ");
      return String(r);
    }).join(" · ");
  };

  let y = headH + 60;
  ctx.fillStyle = C.moradoT; rr(40, headH + 30, W - 80, H - headH - 80, 24); ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
  filas.forEach((v, i) => {
    if (i % 2 === 0) { ctx.fillStyle = "rgba(183,148,255,0.06)"; rr(60, y - rowH / 2 + 6, W - 120, rowH - 8, 8); ctx.fill(); }
    ctx.textBaseline = "middle";
    ctx.textAlign = "left"; ctx.fillStyle = C.ink; ctx.font = "600 24px system-ui";
    ctx.fillText(v.jugador, 80, y);
    const pt = aciertos ? (aciertos[v.jugador]?.pt ?? null) : null;
    if (pt !== null) {
      // marca de acierto y puntos de la porra
      ctx.textAlign = "left"; ctx.font = "20px system-ui";
      ctx.fillStyle = pt > 0 ? C.green : C.red;
      const nomW = ctx.measureText("").width; // keep
      ctx.font = "600 24px system-ui";
      const w2 = ctx.measureText(v.jugador).width;
      ctx.font = "bold 20px system-ui";
      ctx.fillText(pt > 0 ? `✓ +${pt}` : "✗", 80 + w2 + 14, y);
    }
    ctx.textAlign = "right"; ctx.fillStyle = (pt === null) ? C.gold : (pt > 0 ? C.green : "rgba(251,113,133,0.85)"); ctx.font = "bold 24px system-ui";
    ctx.fillText(formatVoto(v), W - 80, y);
    ctx.textBaseline = "alphabetic";
    y += rowH;
  });

  return cv.toDataURL("image/png");
}
