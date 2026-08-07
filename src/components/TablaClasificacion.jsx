import React from "react";
import { C, display, mono, styles } from "../lib/theme.js";

const medals = ["🥇", "🥈", "🥉"];

function Chip({ children, kind }) {
  const col = kind === "v" ? C.green : kind === "u" ? C.gold : kind === "d" ? C.red : C.muted;
  const bord = kind === "v" ? "rgba(74,222,128,0.3)" : kind === "u" ? "rgba(252,211,77,0.3)"
    : kind === "d" ? "rgba(251,113,133,0.3)" : C.line;
  return (
    <span style={{ fontFamily: mono, fontSize: 10, padding: "2px 7px", borderRadius: 6, border: `1px solid ${bord}`, color: col }}>
      {children}
    </span>
  );
}

export default function TablaClasificacion({ filas, renderDetalle }) {
  const [abierto, setAbierto] = React.useState(null);
  const podio = filas.slice(0, 3);

  return (
    <div>

      {/* Podio */}
      {filas.length >= 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", gap: 10, alignItems: "end", margin: "8px 0 18px" }}>
          {[podio[1], podio[0], podio[2]].map((p, idx) => {
            const real = idx === 1; // el del centro es el 1º
            const medalIdx = real ? 0 : idx === 0 ? 1 : 2;
            return (
              <div key={p.jugador} style={{
                background: C.panel, border: `1px solid ${real ? "rgba(252,211,77,0.5)" : C.panelBorder}`,
                borderRadius: 18, padding: real ? "24px 10px 16px" : "16px 10px", textAlign: "center",
                backdropFilter: "blur(8px)",
                boxShadow: real ? "0 12px 40px -12px rgba(252,211,77,0.4)" : "none",
                animation: "fadeIn .5s ease both", animationDelay: `${idx * 0.06}s`,
              }}>
                <div style={{ fontSize: 22 }}>{medals[medalIdx]}</div>
                <div style={{ fontFamily: display, fontWeight: 600, marginTop: 6, fontSize: 15 }}>{p.jugador}</div>
                <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 26, marginTop: 2, color: real ? C.gold : C.ink }}>{p.pt}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lista completa */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filas.map((r, i) => {
          const leader = i === 0;
          return (
            <div key={r.jugador}>
            <div onClick={() => renderDetalle && setAbierto(abierto === r.jugador ? null : r.jugador)} style={{
              cursor: renderDetalle ? "pointer" : "default",
              display: "grid", gridTemplateColumns: "34px 1fr auto", alignItems: "center", gap: 12,
              background: leader ? `linear-gradient(90deg, rgba(124,92,240,0.22), rgba(124,92,196,0.06))` : C.panel,
              border: `1px solid ${leader ? "rgba(183,148,255,0.55)" : C.line}`, borderRadius: 14, padding: "13px 16px",
              boxShadow: leader ? "0 0 30px -10px rgba(124,92,240,0.6)" : "none",
              animation: "fadeIn .45s ease both", animationDelay: `${0.15 + i * 0.04}s`,
            }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontFamily: mono, fontSize: 15, color: leader ? C.gold : C.muted }}>{i + 1}</div>
                {typeof r.mov === "number" && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: r.mov > 0 ? C.green : r.mov < 0 ? C.red : "rgba(185,168,216,0.5)" }}>
                    {r.mov > 0 ? `▲${r.mov}` : r.mov < 0 ? `▼${Math.abs(r.mov)}` : "="}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontFamily: display, fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>
                  {r.jugador}
                  {r.titulos > 0 && <span style={{ marginLeft: 6, fontSize: 13, letterSpacing: "1px" }} title={`${r.titulos} temporada${r.titulos > 1 ? "s" : ""} ganada${r.titulos > 1 ? "s" : ""}`}>{"⭐".repeat(r.titulos)}</span>}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                  <Chip kind="v">{r.v} V</Chip>
                  <Chip kind="u">{r.u} U</Chip>
                  <Chip>{r.q} Q</Chip>
                  <Chip kind="d">{r.d} D</Chip>
                  <Chip>{r.e} E</Chip>
                  <Chip>{r.ap} AP</Chip>
                  {r.ptJornada ? <Chip kind="u">+{r.ptJornada} pts J</Chip> : null}
                  {r.sdpJornada ? <Chip kind="v">+{(r.sdpJornada).toLocaleString("es-ES")} SDP J</Chip> : null}
                </div>
              </div>
              <div style={{ fontFamily: mono, textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>{r.pt}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{(r.sdp || 0).toLocaleString("es-ES")} SDP</div>
              </div>
            </div>
            {abierto === r.jugador && renderDetalle && (
              <div style={{ margin: "6px 0 4px", padding: "12px 16px", background: "rgba(15,10,32,0.5)", border: `1px solid ${C.line}`, borderRadius: 12, animation: "fadeIn .3s ease both" }}>
                {renderDetalle(r.jugador)}
              </div>
            )}
            </div>
          );
        })}
      </div>

      <p style={{ fontFamily: mono, fontSize: 11, color: C.muted, marginTop: 18, textAlign: "center", lineHeight: 1.7 }}>
        AP apuestas · D derrotas · E extra · Q quinielas · U únicas · V victorias · SDP desempate
      </p>
    </div>
  );
}
