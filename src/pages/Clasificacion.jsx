import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { listarTemporadas, recomponerClasificacion, getPalmares, getMovimientos } from "../lib/temporadas.js";
import { estaCerrada } from "../lib/tiempo.js";
import { C, styles } from "../lib/theme.js";
import { Shell, Spinner, Label, Card, SectionTitle } from "../components/ui.jsx";
import TablaClasificacion from "../components/TablaClasificacion.jsx";
import { cargarHistorico, analizarJugador } from "../lib/historico.js";

let _histCache = null;
function DetalleRacha({ jugador }) {
  const [evs, setEvs] = useState(null);
  useEffect(() => {
    (async () => {
      if (!_histCache) _histCache = await cargarHistorico();
      setEvs(_histCache[jugador] || []);
    })();
  }, [jugador]);
  if (!evs) return <div style={{ fontSize: 12, opacity: 0.6 }}>Cargando…</div>;
  if (evs.length === 0) return <div style={{ fontSize: 12, opacity: 0.6 }}>Sin porras registradas todavía.</div>;
  const a = analizarJugador(evs);
  const ult10 = evs.slice(-10);
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Últimas {ult10.length} porras (de antigua a reciente):</div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {ult10.map((e, i) => (
          <span key={i} title={`#${e.jornada} ${e.etiqueta} · ${e.pt} pts`} style={{
            width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800,
            background: e.tipo === "u" ? "rgba(252,211,77,0.25)" : e.pt > 0 ? "rgba(74,222,128,0.2)" : "rgba(251,113,133,0.15)",
            color: e.tipo === "u" ? C.gold : e.pt > 0 ? C.green : C.red,
            border: `1px solid ${e.tipo === "u" ? "rgba(252,211,77,0.4)" : e.pt > 0 ? "rgba(74,222,128,0.35)" : "rgba(251,113,133,0.3)"}`,
          }}>{e.tipo.toUpperCase()}</span>
        ))}
      </div>
      <div style={{ fontSize: 12, marginTop: 8 }}>
        {a.rachaPuntuando >= 2 && <span style={{ color: C.green }}>🔥 {a.rachaPuntuando} porras seguidas puntuando. </span>}
        {a.sinPuntuar >= 2 && <span style={{ color: C.red }}>❄️ Lleva {a.sinPuntuar} porras sin puntuar. </span>}
        {a.rachaPuntuando < 2 && a.sinPuntuar < 2 && <span style={{ opacity: 0.6 }}>Sin racha destacable ahora mismo.</span>}
      </div>
    </div>
  );
}

export default function Clasificacion() {
  const [temporadas, setTemporadas] = useState([]);
  const [selId, setSelId] = useState(null);
  const [filas, setFilas] = useState(null);
  const [porras, setPorras] = useState([]);

  useEffect(() => {
    (async () => {
      const ts = await listarTemporadas();
      setTemporadas(ts);
      const activa = ts.find((t) => t.activa) || ts[0];
      if (activa) setSelId(activa.id);
    })();
  }, []);

  useEffect(() => {
    if (!selId) return;
    (async () => {
      setFilas(null);
      const ordenadas = await recomponerClasificacion(selId);
      const palmares = await getPalmares();
      const mov = await getMovimientos(selId);
      setFilas(ordenadas.map((r) => ({ ...r, ptJornada: 0, titulos: palmares[r.jugador] || 0, mov: mov[r.jugador] ?? 0 })));
      const { data } = await supabase.from("porras").select("*").eq("temporada_id", selId).order("jornada", { ascending: false });
      setPorras(data || []);
    })();
  }, [selId]);

  const sel = temporadas.find((t) => t.id === selId);
  const activas = porras.filter((p) => !estaCerrada(p) && !p.cerrada);
  const cerradas = porras.filter((p) => estaCerrada(p) || p.cerrada);

  return (
    <Shell title="Clasificación" sub={sel ? sel.nombre + (sel.activa ? " (activa)" : " (archivada)") : ""}>
      <Link to="/" style={{ ...styles.btnGhost, display: "inline-block", textDecoration: "none", marginBottom: 16 }}>← Inicio</Link>

      {temporadas.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <Label>Temporada</Label>
          <select value={selId || ""} onChange={(e) => setSelId(+e.target.value)} style={styles.inp}>
            {temporadas.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}{t.activa ? " (activa)" : ""}</option>
            ))}
          </select>
        </div>
      )}

      {/* Porras en curso: votar */}
      {sel?.activa && activas.length > 0 && (
        <Card>
          <SectionTitle>Porras en curso — ¡vota!</SectionTitle>
          {activas.map((p) => (
            <Link key={p.id} to={`/votar/${p.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${C.line}`, textDecoration: "none", color: C.ink, fontSize: 14 }}>
              <span>{p.jornada != null ? `#${p.jornada}` : "★"} · <b>{p.tipo === "partido" ? `${p.local} - ${p.visitante}` : (p.sede || p.comp)}</b></span>
              <span style={{ color: C.accent }}>Votar →</span>
            </Link>
          ))}
        </Card>
      )}

      {!filas ? <Spinner /> : filas.length === 0
        ? <p style={{ opacity: 0.6 }}>Aún no hay datos en esta temporada.</p>
        : <TablaClasificacion filas={filas} renderDetalle={(jug) => <DetalleRacha jugador={jug} />} />}

      {filas && filas.length > 0 && (
        <Link to="/estadisticas" style={{
          display: "block", textDecoration: "none", marginTop: 12, padding: "14px 16px",
          borderRadius: 14, border: `1px solid ${C.panelBorder}`,
          background: "linear-gradient(135deg, rgba(124,92,240,0.18), rgba(124,92,196,0.05))",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>📈 Evolución, estadísticas y rachas →</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            Gráfico de posiciones, gafes y talismanes, cara a cara, gemelos, farolillo…
          </div>
        </Link>
      )}

      {/* Histórico de votaciones de la temporada */}
      {cerradas.length > 0 && (
        <Card>
          <SectionTitle>Histórico de votaciones</SectionTitle>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>Consulta qué votó cada uno en las porras ya cerradas.</div>
          {cerradas.map((p) => (
            <Link key={p.id} to={`/votar/${p.id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.line}`, textDecoration: "none", color: C.ink, fontSize: 13 }}>
              <span>{p.jornada != null ? `#${p.jornada}` : "★"} · {p.tipo === "partido" ? `${p.local} - ${p.visitante}` : (p.sede || p.comp)}</span>
              <span style={{ color: C.accent }}>Ver votos →</span>
            </Link>
          ))}
        </Card>
      )}
    </Shell>
  );
}
