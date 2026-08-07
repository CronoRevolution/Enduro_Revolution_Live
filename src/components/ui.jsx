import React from "react";
import { C, display, mono, styles } from "../lib/theme.js";

export const Card = ({ children }) => <div style={styles.card}>{children}</div>;
export const SectionTitle = ({ children }) => (
  <div style={{ fontFamily: display, fontSize: 14, color: C.accent, marginBottom: 12 }}>{children}</div>
);
export const Label = ({ children }) => (
  <div style={{ fontSize: 11, opacity: 0.7, margin: "10px 0 4px", letterSpacing: 0.5 }}>{children}</div>
);
export const Msg = ({ m }) => m ? (
  <div style={{ marginTop: 12, padding: 10, borderRadius: 6, fontSize: 13, background: m[0] === "ok" ? "#1f5e2a" : "#5e1f1f" }}>{m[1]}</div>
) : null;

const stepBtn = {
  width: 44, height: 44, borderRadius: 14, border: "none", cursor: "pointer",
  background: "linear-gradient(135deg, rgba(183,148,255,0.25), rgba(124,92,240,0.25))",
  color: C.ink, fontSize: 24, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
  fontWeight: 700, boxShadow: "0 2px 8px -2px rgba(0,0,0,0.4)",
};
export const Stepper = ({ label, value, set }) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8, maxWidth: 110, lineHeight: 1.2, minHeight: 26 }}>{label}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button style={stepBtn} onClick={() => set(Math.max(0, value - 1))}>−</button>
      <div style={{
        fontFamily: display, fontSize: 34, fontWeight: 800, minWidth: 56, height: 56,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(15,10,32,0.5)", border: `1px solid ${C.panelBorder}`, borderRadius: 14, color: C.gold,
      }}>{value}</div>
      <button style={stepBtn} onClick={() => set(value + 1)}>+</button>
    </div>
  </div>
);

export const Spinner = () => (
  <div style={{ textAlign: "center", padding: 40, opacity: 0.6 }}>Cargando…</div>
);

export const Shell = ({ title, sub, children }) => (
  <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 18px 80px", animation: "fadeIn .5s ease both" }}>
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontFamily: display, fontWeight: 800, fontSize: 38, letterSpacing: "-0.02em", lineHeight: 1,
        background: `linear-gradient(135deg, #fff, ${C.accent})`, WebkitBackgroundClip: "text",
        backgroundClip: "text", color: "transparent",
      }}>{title}</div>
      {sub && <div style={{ color: C.muted, fontSize: 13, fontFamily: mono, marginTop: 8 }}>// {sub}</div>}
    </div>
    {children}
  </div>
);

export function Plegable({ titulo, children, abiertoInicial = false }) {
  const [abierto, setAbierto] = React.useState(abiertoInicial);
  return (
    <div style={{ ...styles.card }}>
      <button onClick={() => setAbierto(!abierto)} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "transparent", border: "none", color: C.accent, cursor: "pointer",
        fontFamily: display, fontSize: 14, fontWeight: 700, padding: 0,
      }}>
        <span>{titulo}</span>
        <span style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform .2s", fontSize: 12 }}>▼</span>
      </button>
      {abierto && <div style={{ marginTop: 14 }}>{children}</div>}
    </div>
  );
}

// Select con opciones ya usadas + opción de escribir una nueva. Fiable en móvil.
export function SelectOEscribe({ value, onChange, opciones, placeholder }) {
  const [escribiendo, setEscribiendo] = React.useState(false);
  const esNueva = value && !opciones.includes(value);
  React.useEffect(() => { if (esNueva) setEscribiendo(true); }, []); // eslint-disable-line

  if (escribiendo || opciones.length === 0) {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <input style={styles.inp} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        {opciones.length > 0 && (
          <button style={styles.btnGhost} onClick={() => { setEscribiendo(false); onChange(""); }} title="Elegir de la lista">↩</button>
        )}
      </div>
    );
  }
  return (
    <select style={styles.inp} value={value} onChange={(e) => {
      if (e.target.value === "__nueva__") { setEscribiendo(true); onChange(""); }
      else onChange(e.target.value);
    }}>
      <option value="">— elige —</option>
      {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
      <option value="__nueva__">✏️ Escribir nueva…</option>
    </select>
  );
}

// Confeti festivo sin dependencias: lluvia + cañones laterales, formas variadas.
export function Confetti({ fire }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!fire) return;
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = window.innerWidth;
    const H = canvas.height = window.innerHeight;
    const cols = ["#b794ff", "#fcd34d", "#4ade80", "#fb7185", "#7c5cf0", "#22d3ee", "#f472b6"];
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pieza = (x, y, vx, vy) => ({
      x, y, vx, vy, sz: rnd(5, 13), rot: rnd(0, 6.28), vr: rnd(-0.35, 0.35),
      col: cols[Math.floor(Math.random() * cols.length)],
      forma: Math.random() < 0.55 ? "rect" : Math.random() < 0.6 ? "circ" : "cinta",
      osc: rnd(0, 6.28), fase: rnd(0.05, 0.15),
    });
    const piezas = [];
    // lluvia desde arriba
    for (let i = 0; i < 110; i++) piezas.push(pieza(rnd(0, W), rnd(-H * 0.5, -20), rnd(-1.5, 1.5), rnd(2.5, 6)));
    // cañones desde las esquinas inferiores
    for (let i = 0; i < 45; i++) piezas.push(pieza(rnd(-10, 60), H + 10, rnd(3, 9), rnd(-16, -9)));
    for (let i = 0; i < 45; i++) piezas.push(pieza(W - rnd(-10, 60), H + 10, rnd(-9, -3), rnd(-16, -9)));
    let raf, t = 0;
    const DUR = 210;
    const tick = () => {
      t++; ctx.clearRect(0, 0, W, H);
      const fade = t > DUR - 50 ? Math.max(0, (DUR - t) / 50) : 1;
      piezas.forEach((p) => {
        p.osc += p.fase;
        p.x += p.vx + Math.sin(p.osc) * 0.8;
        p.y += p.vy; p.vy += 0.12; p.vx *= 0.995; p.rot += p.vr;
        ctx.save(); ctx.globalAlpha = fade; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        if (p.forma === "rect") ctx.fillRect(-p.sz / 2, -p.sz / 2, p.sz, p.sz * 0.6);
        else if (p.forma === "circ") { ctx.beginPath(); ctx.arc(0, 0, p.sz * 0.4, 0, 6.28); ctx.fill(); }
        else { // cinta ondulante
          ctx.beginPath(); ctx.moveTo(-p.sz, 0);
          ctx.quadraticCurveTo(0, -p.sz * 0.8, p.sz, 0);
          ctx.quadraticCurveTo(0, p.sz * 0.8, -p.sz, 0);
          ctx.fill();
        }
        ctx.restore();
      });
      if (t < DUR) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [fire]);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }} />;
}
