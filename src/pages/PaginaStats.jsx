import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarTemporadas } from "../lib/temporadas.js";
import { C, display, styles } from "../lib/theme.js";
import { Shell, Spinner, Label, Card } from "../components/ui.jsx";
import { GraficoEvolucion } from "../components/Estadisticas.jsx";
import { cargarDatosStats, caraACara, proyeccion } from "../lib/estadisticas.js";
import RachasJugadores from "../components/RachasJugadores.jsx";
import { cargarHistorico } from "../lib/historico.js";
import { logrosDeTodos, LOGROS } from "../lib/logros.js";

const SUBTABS = [
  ["evolucion", "📈 Evolución"],
  ["stats", "🔮 Estadísticas"],
  ["rachas", "🔥 Rachas"],
  ["logros", "🏅 Logros"],
];

// Panel público: solo cara a cara y proyección (el resto es privado del admin).
function PanelPublico({ temporada }) {
  const [D, setD] = useState(null);
  const [jugA, setJugA] = useState("");
  const [jugB, setJugB] = useState("");
  const [restantes, setRestantes] = useState("10");

  useEffect(() => { setD(null); cargarDatosStats(temporada.id).then(setD); }, [temporada.id]);
  if (!D) return <Spinner />;

  const jugadores = [...new Set(D.resultados.map((r) => r.jugador))].sort((a, b) => a.localeCompare(b, "es"));
  const cc = jugA && jugB && jugA !== jugB ? caraACara(D, jugA, jugB) : null;
  const proy = proyeccion(D, +restantes || 0);

  return (
    <>
      <Card>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, marginBottom: 10 }}>⚔️ Cara a cara</div>
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
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, marginBottom: 10 }}>🔮 Proyección</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Si quedan</span>
          <input style={{ ...styles.inp, width: 70 }} type="number" value={restantes} onChange={(e) => setRestantes(e.target.value)} />
          <span style={{ fontSize: 12, opacity: 0.7 }}>porras, al ritmo actual:</span>
        </div>
        {proy.slice(0, 8).map((f, i) => (
          <div key={f.jugador} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
            <span>{i + 1}. {f.jugador} <span style={{ opacity: 0.5, fontSize: 11 }}>({f.ritmo} pts/porra)</span></span>
            <b style={{ color: i === 0 ? C.gold : C.ink }}>{f.proyectado} pts</b>
          </div>
        ))}
        <div style={{ fontSize: 10, opacity: 0.5, marginTop: 8 }}>Proyección lineal simple. El fútbol dirá otra cosa.</div>
      </Card>
    </>
  );
}

// Panel de logros: medallas desbloqueadas por cada jugador.
function PanelLogros({ temporadaId }) {
  const [datos, setDatos] = useState(null);
  const [abierto, setAbierto] = useState(null);

  useEffect(() => {
    setDatos(null);
    (async () => {
      const hist = await cargarHistorico();
      setDatos({ logros: logrosDeTodos(hist, temporadaId), total: LOGROS.length });
    })();
  }, [temporadaId]);

  if (!datos) return <Spinner />;
  const jugadores = Object.entries(datos.logros)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "es"));

  return (
    <>
      <Card>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Logros desbloqueados</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
          {datos.total} medallas posibles <b>en esta temporada</b>. Toca un jugador para ver las suyas.
        </div>
        {jugadores.map(([jug, ls]) => (
          <div key={jug}>
            <div onClick={() => setAbierto(abierto === jug ? null : jug)} style={{
              cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 12px", marginBottom: 5, borderRadius: 12,
              background: "rgba(255,255,255,0.03)", border: `1px solid ${C.line}`,
            }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{jug}</span>
              <span style={{ fontSize: 15 }}>
                {ls.slice(0, 6).map((l) => l.emoji).join(" ")}
                <span style={{ fontSize: 12, color: C.muted, marginLeft: 6 }}>{ls.length}/{datos.total}</span>
              </span>
            </div>
            {abierto === jug && (
              <div style={{ padding: "10px 14px", marginBottom: 8, borderRadius: 12, background: "rgba(15,10,32,0.5)", border: `1px solid ${C.line}` }}>
                {ls.length === 0
                  ? <div style={{ fontSize: 12, opacity: 0.6 }}>Todavía sin medallas. ¡Todo por ganar!</div>
                  : ls.map((l) => (
                    <div key={l.key} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.line}` }}>
                      <span style={{ fontSize: 22 }}>{l.emoji}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{l.nombre}</div>
                        <div style={{ fontSize: 11, opacity: 0.75 }}>{l.desc} · {l.detalle}</div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </Card>

      <Card>
        <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Todas las medallas</div>
        {LOGROS.map((l) => (
          <div key={l.key} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: `1px solid ${C.line}` }}>
            <span style={{ fontSize: 20, opacity: 0.9 }}>{l.emoji}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{l.nombre}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{l.desc}</div>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

export default function PaginaStats() {
  const [temporadas, setTemporadas] = useState([]);
  const [sel, setSel] = useState(null);
  const [sub, setSub] = useState("evolucion");

  useEffect(() => {
    (async () => {
      const ts = await listarTemporadas();
      setTemporadas(ts);
      const activa = ts.find((t) => t.activa) || ts[0];
      if (activa) setSel(activa);
    })();
  }, []);

  if (!sel) return <Shell title="Estadísticas"><Spinner /></Shell>;

  return (
    <Shell title="Estadísticas" sub="Rachas, récords y curiosidades del grupo">
      <div style={{ marginBottom: 14 }}>
        <Link to="/" style={{ ...styles.btnGhost, textDecoration: "none", display: "inline-block" }}>← Inicio</Link>
      </div>
      {temporadas.length > 1 && (
        <Card>
          <Label>Temporada</Label>
          <select
            style={styles.inp}
            value={sel.id}
            onChange={(e) => setSel(temporadas.find((t) => t.id === +e.target.value))}
          >
            {temporadas.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}{t.activa ? " (en curso)" : ""}</option>
            ))}
          </select>
        </Card>
      )}

      {/* sub-pestañas */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {SUBTABS.map(([id, txt]) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            style={{
              padding: "9px 15px", borderRadius: 10,
              border: `1px solid ${sub === id ? C.accent : C.panelBorder}`,
              background: sub === id ? "linear-gradient(135deg, #b794ff, #7c5cf0)" : "transparent",
              color: sub === id ? "#fff" : C.muted,
              fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: display,
            }}
          >{txt}</button>
        ))}
      </div>

      {sub === "evolucion" && (
        <Card>
          <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
            Evolución de la temporada
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            La posición de cada jugador tras cada porra. Toca un nombre para seguir su camino.
          </div>
          <GraficoEvolucion temporadaId={sel.id} />
        </Card>
      )}

      {sub === "stats" && <PanelPublico temporada={sel} />}

      {sub === "rachas" && <RachasJugadores temporada={sel} publico />}

      {sub === "logros" && <PanelLogros temporadaId={sel.id} />}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <Link to="/" style={{ ...styles.btnGhost, flex: 1, textAlign: "center", textDecoration: "none" }}>🏠 Inicio</Link>
        <Link to="/clasificacion" style={{ ...styles.btnGhost, flex: 1, textAlign: "center", textDecoration: "none" }}>📊 Clasificación</Link>
      </div>
    </Shell>
  );
}
