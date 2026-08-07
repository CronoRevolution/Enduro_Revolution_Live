import React, { useEffect, useState } from "react";
import { cargarHistorico, generarDestacados, fichaJugador } from "../lib/historico.js";
import { C, styles } from "../lib/theme.js";
import { Card, SectionTitle, Label, Spinner } from "./ui.jsx";

const COLOR_NIVEL = { hito: C.gold, racha: C.green, sequia: C.red, dato: C.muted };

// Lista de destacados (compacta). Carga el histórico al montar.
// porraRecienteId: si se pasa, resalta hitos de esa porra.
export function DestacadosRachas({ temporadaId, porraRecienteId = null, compacto = false }) {
  const [destacados, setDestacados] = useState(null);
  useEffect(() => {
    cargarHistorico().then((pj) => setDestacados(generarDestacados(pj, temporadaId, porraRecienteId)));
  }, [temporadaId, porraRecienteId]);

  if (!destacados) return <Spinner />;
  if (destacados.length === 0) return <p style={{ fontSize: 12, opacity: 0.6 }}>Nada destacable por ahora.</p>;
  const lista = compacto ? destacados.slice(0, 8) : destacados;
  return (
    <div>
      {lista.map((d, i) => (
        <div key={i} style={{ padding: "7px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13, color: COLOR_NIVEL[d.nivel] || C.ink }}>
          {d.texto}
        </div>
      ))}
      {compacto && destacados.length > 8 && (
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>+{destacados.length - 8} más en la pestaña Rachas.</div>
      )}
    </div>
  );
}

// Pestaña completa: destacados + ficha por jugador.
export default function RachasJugadores({ temporada, publico = false }) {
  const [porJugador, setPorJugador] = useState(null);
  const [sel, setSel] = useState("");

  useEffect(() => { cargarHistorico().then(setPorJugador); }, []);

  if (!porJugador) return <Spinner />;
  const jugadores = Object.keys(porJugador).sort((a, b) => a.localeCompare(b, "es"));
  const destacados = generarDestacados(porJugador, temporada.id);

  return (
    <>
      {!publico && (
      <Card>
        <SectionTitle>Destacados</SectionTitle>
        <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 10 }}>
          Rachas y sequías de todos los participantes, cruzando temporadas. Útil para los comentarios de jornada.
          Solo cubre porras registradas en la app (lo anterior a la base importada no se puede rastrear).
        </div>
        {destacados.length === 0
          ? <p style={{ fontSize: 12, opacity: 0.6 }}>Nada destacable por ahora.</p>
          : destacados.map((d, i) => (
            <div key={i} style={{ padding: "7px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13, color: COLOR_NIVEL[d.nivel] || C.ink }}>
              {d.texto}
            </div>
          ))}
      </Card>
      )}
      <Card>
        <SectionTitle>Ficha por jugador</SectionTitle>
        <Label>Jugador</Label>
        <select style={styles.inp} value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">— elige —</option>
          {jugadores.map((j) => <option key={j} value={j}>{j}</option>)}
        </select>
        {sel && porJugador[sel] && (
          <div style={{ marginTop: 12 }}>
            {fichaJugador(porJugador[sel], temporada.id).map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
                <span style={{ opacity: 0.7 }}>{k}</span><b>{v}</b>
              </div>
            ))}
            <Label>Últimas 10 porras</Label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
              {porJugador[sel].slice(-10).map((e, i) => (
                <span key={i} title={`#${e.jornada} ${e.etiqueta} · ${e.pt} pts`} style={{
                  width: 26, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  background: e.tipo === "u" ? "rgba(252,211,77,0.25)" : e.pt > 0 ? "rgba(74,222,128,0.2)" : "rgba(251,113,133,0.15)",
                  color: e.tipo === "u" ? C.gold : e.pt > 0 ? C.green : C.red,
                }}>{e.tipo.toUpperCase()}</span>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
