import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarTemporadas, getPalmares, getRecordsHistoricos } from "../lib/temporadas.js";
import { C, display, mono, styles } from "../lib/theme.js";
import { Shell, Spinner, Card, SectionTitle } from "../components/ui.jsx";

export default function SalonFama() {
  const [temporadas, setTemporadas] = useState(null);
  const [palmares, setPalmares] = useState({});
  const [records, setRecords] = useState([]);

  useEffect(() => {
    (async () => {
      const ts = await listarTemporadas();
      setTemporadas(ts);
      setPalmares(await getPalmares());
      const activa = ts.find((t) => t.activa) || ts[0];
      if (activa) {
        try { setRecords(await getRecordsHistoricos(activa.id)); } catch { /* silencioso */ }
      }
    })();
  }, []);

  if (!temporadas) return <Shell title="Salón de la Fama"><Spinner /></Shell>;

  // ranking de palmarés: jugadores ordenados por títulos
  const ranking = Object.entries(palmares)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));

  const conCampeon = temporadas.filter((t) => t.campeon);

  return (
    <Shell title="🏛️ Salón de la Fama" sub="Toda la historia de La Hoja De Mis Apuestas">
      <div style={{ marginBottom: 14 }}>
        <Link to="/" style={{ ...styles.btnGhost, textDecoration: "none", display: "inline-block" }}>← Inicio</Link>
      </div>
      <Card>
        <SectionTitle>👑 Palmarés</SectionTitle>
        {ranking.length === 0
          ? <p style={{ fontSize: 12, opacity: 0.6 }}>Aún no hay campeones registrados.</p>
          : ranking.map(([jug, n], i) => (
            <div key={jug} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "11px 14px", marginBottom: 6, borderRadius: 12,
              background: i === 0
                ? "linear-gradient(90deg, rgba(252,211,77,0.18), rgba(252,211,77,0.03))"
                : "rgba(255,255,255,0.03)",
              border: `1px solid ${i === 0 ? "rgba(252,211,77,0.5)" : C.line}`,
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: mono, fontSize: 13, color: C.muted, minWidth: 20 }}>{i + 1}</span>
                <b style={{ fontSize: 15 }}>{jug}</b>
              </span>
              <span style={{ color: C.gold, fontSize: 15, letterSpacing: 1 }}>
                {"⭐".repeat(Math.min(n, 6))}{n > 6 ? ` ×${n}` : ""}
              </span>
            </div>
          ))}
      </Card>

      {records.length > 0 && (
        <Card>
          <SectionTitle>📜 Récords históricos</SectionTitle>
          {records.map((r, i) => (
            <div key={i} style={{
              padding: "8px 0", borderBottom: `1px solid ${C.line}`,
              fontSize: 13, color: r.esActual ? C.green : C.ink,
              fontWeight: r.esActual ? 700 : 400,
            }}>
              {r.esActual ? "🔥 " : "• "}{r.texto}
            </div>
          ))}
          {records.some((r) => r.esActual) && (
            <div style={{ fontSize: 11, color: C.green, marginTop: 8 }}>
              🔥 = récord logrado en la temporada en curso
            </div>
          )}
        </Card>
      )}

      <Card>
        <SectionTitle>🗓️ Campeones por temporada</SectionTitle>
        {conCampeon.length === 0
          ? <p style={{ fontSize: 12, opacity: 0.6 }}>Todavía no hay temporadas con campeón asignado.</p>
          : conCampeon.map((t) => (
            <div key={t.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 0", borderBottom: `1px solid ${C.line}`, fontSize: 14,
            }}>
              <span style={{ fontFamily: display, color: C.muted }}>
                Temporada {t.nombre}{t.activa ? <span style={{ color: C.green, fontSize: 11 }}> · en curso</span> : ""}
              </span>
              <span style={{ color: C.gold, fontWeight: 700 }}>🏆 {t.campeon}</span>
            </div>
          ))}
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 10 }}>
          {temporadas.length} temporadas registradas.
        </div>
      </Card>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        <Link to="/" style={{ ...styles.btnGhost, flex: 1, textAlign: "center", textDecoration: "none" }}>🏠 Inicio</Link>
        <Link to="/clasificacion" style={{ ...styles.btnGhost, flex: 1, textAlign: "center", textDecoration: "none" }}>📊 Clasificación</Link>
        <Link to="/estadisticas" style={{ ...styles.btnGhost, flex: 1, textAlign: "center", textDecoration: "none" }}>🔮 Estadísticas</Link>
      </div>
    </Shell>
  );
}
