import React, { useEffect, useState } from "react";
import { cargarDatosStats, gafeTalisman, menteColmena, gemelos, evolucionPosiciones, farolillo, caraACara, proyeccion } from "../lib/estadisticas.js";
import { C, styles } from "../lib/theme.js";
import { Card, SectionTitle, Label, Spinner } from "./ui.jsx";

export default function Estadisticas({ temporada }) {
  const [D, setD] = useState(null);
  const [jugA, setJugA] = useState("");
  const [jugB, setJugB] = useState("");
  const [restantes, setRestantes] = useState("10");

  useEffect(() => { cargarDatosStats(temporada.id).then(setD); }, [temporada.id]);
  if (!D) return <Spinner />;

  const gt = gafeTalisman(D);
  const mc = menteColmena(D);
  const gem = gemelos(D);
  const pasos = evolucionPosiciones(D);
  const far = farolillo(pasos);
  const jugadores = [...new Set(D.resultados.map((r) => r.jugador))].sort((a, b) => a.localeCompare(b, "es"));
  const cc = jugA && jugB && jugA !== jugB ? caraACara(D, jugA, jugB) : null;
  const proy = proyeccion(D, +restantes || 0);

  // Duelo de la jornada: los dos jugadores más igualados de la tabla
  const duelo = (() => {
    const acum = {};
    (D.base || []).forEach((b) => { acum[b.jugador] = { pt: b.pt || 0, sdp: b.sdp || 0 }; });
    (D.resultados || []).forEach((r) => {
      acum[r.jugador] = acum[r.jugador] || { pt: 0, sdp: 0 };
      acum[r.jugador].pt += r.pt || 0; acum[r.jugador].sdp += r.sdp || 0;
    });
    const orden = Object.entries(acum).sort((a, b) => b[1].pt - a[1].pt || b[1].sdp - a[1].sdp);
    if (orden.length < 2) return null;
    let mejor = null;
    for (let i = 0; i < orden.length - 1; i++) {
      const dif = orden[i][1].pt - orden[i + 1][1].pt;
      if (!mejor || dif < mejor.dif) {
        mejor = { dif, a: orden[i][0], ptA: orden[i][1].pt, posA: i + 1, b: orden[i + 1][0], ptB: orden[i + 1][1].pt, posB: i + 2 };
      }
    }
    if (!mejor) return null;
    return { ...mejor, h2h: caraACara(D, mejor.a, mejor.b) };
  })();

  return (
    <>
      <Card>
        <SectionTitle>🐈‍⬛ Gafes y talismanes</SectionTitle>
        <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 10 }}>Cuando un jugador da ganador a un equipo (3+ veces), ¿ese equipo gana? El gafe es su peor equipo; el talismán, el mejor.</div>
        {Object.keys(gt).length === 0
          ? <p style={{ fontSize: 12, opacity: 0.6 }}>Aún no hay suficientes datos (se necesitan 3+ apuestas por el mismo equipo).</p>
          : Object.entries(gt).map(([jug, d]) => (
            <div key={jug} style={{ padding: "7px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
              <b>{jug}</b>:
              {d.gafe.pct <= 40 && <span style={{ color: C.red }}> gafe con {d.gafe.equipo} ({d.gafe.aciertos}/{d.gafe.picks}, {d.gafe.pct}%)</span>}
              {d.talisman.pct >= 60 && d.talisman.equipo !== d.gafe.equipo && <span style={{ color: C.green }}> · talismán de {d.talisman.equipo} ({d.talisman.aciertos}/{d.talisman.picks}, {d.talisman.pct}%)</span>}
              {d.gafe.pct > 40 && (d.talisman.pct < 60 || d.talisman.equipo === d.gafe.equipo) && <span style={{ opacity: 0.6 }}> sin gafes ni talismanes claros</span>}
            </div>
          ))}
      </Card>

      {duelo && (
        <Card>
          <SectionTitle>🥊 Duelo de la jornada</SectionTitle>
          <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 10 }}>
            Los dos más igualados de la clasificación ahora mismo.
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", textAlign: "center", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.muted }}>{duelo.posA}º</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{duelo.a}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.gold }}>{duelo.ptA}</div>
            </div>
            <div style={{ fontSize: 26 }}>🥊</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: C.muted }}>{duelo.posB}º</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{duelo.b}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>{duelo.ptB}</div>
            </div>
          </div>
          <div style={{ textAlign: "center", fontSize: 13, marginTop: 10 }}>
            {duelo.dif === 0
              ? <b style={{ color: C.red }}>¡Empatados a puntos!</b>
              : <>Les separa <b style={{ color: C.red }}>{duelo.dif}</b> {duelo.dif === 1 ? "punto" : "puntos"}</>}
          </div>
          {duelo.h2h && duelo.h2h.comunes > 0 && (
            <div style={{ textAlign: "center", fontSize: 12, opacity: 0.8, marginTop: 8 }}>
              Cara a cara: {duelo.h2h.ganaA}–{duelo.h2h.ganaB} ({duelo.h2h.empates} empates) en {duelo.h2h.comunes} porras
              {duelo.h2h.racha > 1 && duelo.h2h.rachaDe ? ` · ${duelo.h2h.rachaDe} domina las últimas ${duelo.h2h.racha}` : ""}
            </div>
          )}
        </Card>
      )}

      <Card>
        <SectionTitle>⚔️ Cara a cara</SectionTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <select style={styles.inp} value={jugA} onChange={(e) => setJugA(e.target.value)}>
            <option value="">— jugador A —</option>{jugadores.map((j) => <option key={j}>{j}</option>)}
          </select>
          <select style={styles.inp} value={jugB} onChange={(e) => setJugB(e.target.value)}>
            <option value="">— jugador B —</option>{jugadores.map((j) => <option key={j}>{j}</option>)}
          </select>
        </div>
        {cc && (
          <div style={{ marginTop: 12, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center", marginBottom: 8 }}>
              <div><div style={{ fontSize: 24, fontWeight: 800, color: C.accent }}>{cc.ganaA}</div><div style={{ fontSize: 11, opacity: 0.7 }}>{jugA}</div></div>
              <div><div style={{ fontSize: 24, fontWeight: 800, opacity: 0.5 }}>{cc.empates}</div><div style={{ fontSize: 11, opacity: 0.7 }}>empates</div></div>
              <div><div style={{ fontSize: 24, fontWeight: 800, color: C.gold }}>{cc.ganaB}</div><div style={{ fontSize: 11, opacity: 0.7 }}>{jugB}</div></div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, textAlign: "center" }}>
              {cc.comunes} porras en común{cc.racha > 1 && cc.rachaDe ? ` · ${cc.rachaDe} domina las últimas ${cc.racha}` : ""}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>🐝 Mente colmena</SectionTitle>
        {mc.porrasAnalizadas === 0 ? <p style={{ fontSize: 12, opacity: 0.6 }}>Sin partidos suficientes.</p> : (
          <div style={{ fontSize: 13 }}>
            En {mc.porrasAnalizadas} partidos, el <b>voto mayoritario del grupo</b> acertó el 1X2 el <b style={{ color: C.accent }}>{mc.grupoPct}%</b> de las veces,
            frente al <b style={{ color: C.muted }}>{mc.indivPct}%</b> de media individual.
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
              {mc.grupoPct > mc.indivPct ? "La sabiduría colectiva funciona: el grupo acierta más que sus miembros por separado. 🐝" : "De momento no hay sabiduría colectiva que valga: individualmente lo hacéis igual o mejor. 😅"}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>👯 Gemelos</SectionTitle>
        <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 10 }}>Parejas que votan idéntico (mismo marcador o respuesta) en al menos el 60% de sus porras comunes (mín. 5).</div>
        {gem.length === 0
          ? <p style={{ fontSize: 12, opacity: 0.6 }}>No hay gemelos por ahora. Cada uno va a lo suyo.</p>
          : gem.map((g, i) => (
            <div key={i} style={{ padding: "7px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
              <b>{g.pareja[0]}</b> y <b>{g.pareja[1]}</b>: idénticos en {g.identicos} de {g.comunes} ({g.pct}%)
            </div>
          ))}
      </Card>

      {far && (
        <Card>
          <SectionTitle>🏮 Farolillo rojo</SectionTitle>
          <div style={{ fontSize: 13 }}>
            <b style={{ color: C.red }}>{far.ultimo}</b> cierra la clasificación{far.racha > 1 ? `, y ya van ${far.racha} porras seguidas ahí abajo` : ""}.
            {far.record.jugador && far.record.n > 2 && (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Récord de la temporada: {far.record.jugador} aguantó {far.record.n} porras seguidas en el último puesto.</div>
            )}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>🔮 Proyección</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Label>Si quedan</Label>
          <input style={{ ...styles.inp, width: 70 }} type="number" value={restantes} onChange={(e) => setRestantes(e.target.value)} />
          <span style={{ fontSize: 12, opacity: 0.7 }}>porras, al ritmo actual de cada uno:</span>
        </div>
        {proy.slice(0, 8).map((f, i) => (
          <div key={f.jugador} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
            <span>{i + 1}. {f.jugador} <span style={{ opacity: 0.5, fontSize: 11 }}>({f.ritmo} pts/porra)</span></span>
            <b style={{ color: i === 0 ? C.gold : C.ink }}>{f.proyectado} pts</b>
          </div>
        ))}
        <div style={{ fontSize: 10, opacity: 0.5, marginTop: 8 }}>Proyección lineal simple: puntos actuales + ritmo × porras restantes. El fútbol dirá otra cosa.</div>
      </Card>
    </>
  );
}

// Gráfico de evolución de posiciones (SVG, estilo neón). Para la clasificación pública.
const PALETA = ["#b794ff","#fcd34d","#4ade80","#fb7185","#60a5fa","#f97316","#34d399","#f472b6","#a3e635","#22d3ee","#c084fc","#fbbf24","#e879f9","#94a3b8","#fda4af"];

// Convierte puntos en una curva suave (Catmull-Rom → Bézier).
function suave(pts) {
  if (pts.length < 3) return "M" + pts.map((p) => p.join(",")).join(" L");
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function GraficoEvolucion({ temporadaId }) {
  const [pasos, setPasos] = useState(null);
  const [sel, setSel] = useState(null);

  useEffect(() => {
    cargarDatosStats(temporadaId).then((D) => setPasos(evolucionPosiciones(D)));
  }, [temporadaId]);

  if (!pasos) return <Spinner />;
  if (pasos.length < 2) return <p style={{ fontSize: 12, opacity: 0.6 }}>Aún no hay suficientes porras para dibujar la evolución.</p>;

  const datos = pasos.slice(-30);
  const jugadores = Object.keys(datos[datos.length - 1].posiciones);
  const N = jugadores.length;
  // Medidas pensadas para móvil: el SVG se adapta al ancho disponible sin scroll horizontal.
  const W = 380, H = 46 + N * 22, padL = 12, padR = 96, padT = 16, padB = 18;
  const x = (i) => padL + (i / (datos.length - 1)) * (W - padL - padR);
  const y = (pos) => padT + ((pos - 1) / (N - 1)) * (H - padT - padB);

  return (
    <div>
      <style>{`
        @keyframes trazar { to { stroke-dashoffset: 0; } }
        @keyframes aparecer { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
        <defs>
          <linearGradient id="evoBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#241640" /><stop offset="100%" stopColor="#150d28" />
          </linearGradient>
          <filter id="evoGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect x="0" y="0" width={W} height={H} rx="18" fill="url(#evoBg)" stroke="rgba(183,148,255,0.25)" />
        {/* rejilla de puntos */}
        {Array.from({ length: N }, (_, r) =>
          Array.from({ length: Math.min(datos.length, 10) }, (_, c) => (
            <circle key={`${r}-${c}`} cx={padL + (c / Math.max(1, Math.min(datos.length, 10) - 1)) * (W - padL - padR)} cy={y(r + 1)} r="1" fill="rgba(183,148,255,0.14)" />
          ))
        )}
        {jugadores.map((jug, k) => {
          const color = PALETA[k % PALETA.length];
          const pts = datos.map((p, i) => [x(i), y(p.posiciones[jug] ?? N)]);
          const apagado = sel && sel !== jug;
          const resaltado = sel === jug;
          const ultPos = datos[datos.length - 1].posiciones[jug];
          return (
            <g key={jug} opacity={apagado ? 0.10 : 1} style={{ cursor: "pointer" }} onClick={() => setSel(sel === jug ? null : jug)}>
              <path d={suave(pts)} fill="none" stroke={color} strokeWidth={resaltado ? 2.6 : 1.5}
                strokeLinecap="round" filter={resaltado ? "url(#evoGlow)" : undefined}
                pathLength="1" strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: `trazar 2.4s ease-out forwards`, animationDelay: `${k * 0.09}s` }} />
              <circle cx={x(datos.length - 1)} cy={y(ultPos)} r={resaltado ? 3.2 : 2.2} fill={color}
                filter={resaltado ? "url(#evoGlow)" : undefined}
                style={{ opacity: 0, animation: "aparecer .4s ease forwards", animationDelay: `${2.2 + k * 0.09}s` }} />
              {/* chip con posición + nombre */}
              <g transform={`translate(${W - padR + 4}, ${y(ultPos) - 7.5})`}
                style={{ opacity: 0, animation: "aparecer .4s ease forwards", animationDelay: `${2.3 + k * 0.09}s` }}>
                <rect width="90" height="15" rx="7.5" fill={resaltado ? color : "rgba(0,0,0,0.35)"}
                  stroke={color} strokeWidth={resaltado ? 0 : 1} opacity={resaltado ? 1 : 0.9} />
                <text x="6" y="11" fontSize="9.5" fontWeight="800" fill={resaltado ? "#1a1130" : color}>
                  {ultPos}º {jug.length > 10 ? jug.slice(0, 9) + "…" : jug}
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>Posición tras cada porra (últimas {datos.length}). Toca un nombre para iluminar su camino.</div>
    </div>
  );
}
