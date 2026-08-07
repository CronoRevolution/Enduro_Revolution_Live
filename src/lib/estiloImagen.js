// Estilo visual "estadio nocturno" compartido por las imágenes de la app.
// Paleta de la familia morada de siempre, pero más viva.

export const P = {
  bg: "#0E0822",
  bg2: "#1E0E3E",
  morado: "#A855F7",
  lila: "#C4A9FF",
  verde: "#34D399",
  dorado: "#FCD34D",
  rosa: "#F472B6",
  cian: "#22D3EE",
  ink: "#F5F1FF",
  gris: "#968AB9",
  tenue: "#78699E",
};

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Fondo: degradado + haces de luz de focos + textura de puntos.
export function lienzo(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, P.bg2);
  g.addColorStop(0.55, "#160A34");
  g.addColorStop(1, P.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // haces de luz desde arriba
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const focos = [
    [0.18, "rgba(120,70,210,0.30)"],
    [0.82, "rgba(190,90,230,0.28)"],
    [0.50, "rgba(90,60,180,0.22)"],
  ];
  focos.forEach(([fx, col]) => {
    const x = fx * W;
    const grad = ctx.createLinearGradient(x, 0, x, H * 0.85);
    grad.addColorStop(0, col);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x, -20);
    ctx.lineTo(x - W * 0.34, H * 0.85);
    ctx.lineTo(x + W * 0.34, H * 0.85);
    ctx.closePath();
    ctx.fill();
  });
  // halo cálido inferior
  const halo = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, H * 0.55);
  halo.addColorStop(0, "rgba(120,50,180,0.28)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // textura de puntos
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.045)";
  for (let y = 0; y < H; y += 16) {
    for (let x = 0; x < W; x += 16) ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
}

// Texto con resplandor de neón.
export function glowText(ctx, txt, x, y, font, color, blur = 18, align = "center") {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(txt, x, y);
  ctx.shadowBlur = blur * 0.5;
  ctx.fillText(txt, x, y);
  ctx.restore();
}

// Píldora con borde de neón. (x,y) es el centro. Devuelve su anchura.
export function chip(ctx, txt, x, y, font, color, padX = 24, padY = 12) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(txt).width;
  const size = parseInt(font, 10) || 26;
  const w = tw + padX * 2, h = size + padY * 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = "rgba(10,5,26,0.72)";
  rr(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(txt, x, y);
  ctx.restore();
  return w;
}

// Panel redondeado translúcido, opcionalmente con halo.
export function panel(ctx, x, y, w, h, r, fill, stroke, glow, lw = 2) {
  ctx.save();
  if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 16; }
  if (fill) { ctx.fillStyle = fill; rr(ctx, x, y, w, h, r); ctx.fill(); }
  ctx.shadowBlur = 0;
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; rr(ctx, x, y, w, h, r); ctx.stroke(); }
  ctx.restore();
}

// Franja diagonal de fondo.
export function franjaDiagonal(ctx, W, y, alto, color, inclin = 70) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-50, y);
  ctx.lineTo(W + 50, y - inclin);
  ctx.lineTo(W + 50, y - inclin + alto);
  ctx.lineTo(-50, y + alto);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Escudo con halo de neón. img puede ser null (dibuja un escudo de reserva).
export function escudoConHalo(ctx, img, cx, cy, size, haloColor, textoFallback = "") {
  const r = size * 0.72;
  ctx.save();
  // halo
  const g = ctx.createRadialGradient(cx, cy, size * 0.2, cx, cy, r * 1.5);
  g.addColorStop(0, haloColor.replace(")", ",0.42)").replace("rgb", "rgba"));
  g.addColorStop(0.6, haloColor.replace(")", ",0.16)").replace("rgb", "rgba"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
  ctx.fill();
  // anillo
  ctx.strokeStyle = haloColor.replace(")", ",0.55)").replace("rgb", "rgba");
  ctx.lineWidth = 3;
  ctx.shadowColor = haloColor.replace(")", ",0.9)").replace("rgb", "rgba");
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  if (img) {
    // encajar manteniendo proporción
    const esc = Math.min(size / img.width, size / img.height);
    const w = img.width * esc, h = img.height * esc;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.ink;
    ctx.font = `bold ${Math.round(size * 0.34)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((textoFallback || "?").slice(0, 3).toUpperCase(), cx, cy);
    ctx.restore();
  }
}

// Línea de neón horizontal.
export function lineaNeon(ctx, x1, x2, y, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.restore();
}

// Recorta un texto para que quepa en un ancho dado.
export function recortar(ctx, txt, maxW) {
  if (ctx.measureText(txt).width <= maxW) return txt;
  let t = txt;
  while (t.length > 3 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

// Reparte un texto en varias líneas para que quepa en un ancho dado.
export function envolver(ctx, txt, maxW, maxLineas = 3) {
  const palabras = String(txt || "").split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = "";
  for (const w of palabras) {
    const prueba = actual ? actual + " " + w : w;
    if (ctx.measureText(prueba).width <= maxW || !actual) actual = prueba;
    else { lineas.push(actual); actual = w; }
    if (lineas.length === maxLineas) break;
  }
  if (actual && lineas.length < maxLineas) lineas.push(actual);
  // si sobró texto, marcamos la última línea
  if (lineas.length === maxLineas) {
    const usadas = lineas.join(" ").split(/\s+/).length;
    if (usadas < palabras.length) {
      let ult = lineas[maxLineas - 1];
      while (ult.length > 4 && ctx.measureText(ult + "…").width > maxW) ult = ult.slice(0, -1);
      lineas[maxLineas - 1] = ult + "…";
    }
  }
  return lineas;
}
