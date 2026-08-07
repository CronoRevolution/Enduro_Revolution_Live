import React, { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { C, display, mono, styles } from "./lib/theme.js";
import { Spinner } from "./components/ui.jsx";
import { supabase } from "./lib/supabase.js";
import { getTemporadaActiva, recomponerClasificacion, getPalmares } from "./lib/temporadas.js";
import { estaCerrada } from "./lib/tiempo.js";
import Votar from "./pages/Votar.jsx";
import Admin from "./pages/Admin.jsx";
import Clasificacion from "./pages/Clasificacion.jsx";
import PaginaStats from "./pages/PaginaStats.jsx";
import SalonFama from "./pages/SalonFama.jsx";
import InstalarApp from "./components/InstalarApp.jsx";

function Home() {
  const [loading, setLoading] = useState(true);
  const [temporada, setTemporada] = useState(null);
  const [porras, setPorras] = useState([]);
  const [lider, setLider] = useState(null);
  const [verN, setVerN] = useState(10);

  useEffect(() => {
    (async () => {
      const t = await getTemporadaActiva();
      setTemporada(t);
      if (t) {
        const { data } = await supabase.from("porras").select("*").eq("temporada_id", t.id).order("jornada", { ascending: false });
        setPorras(data || []);
        const filas = await recomponerClasificacion(t.id);
        if (filas.length) {
          const palmares = await getPalmares();
          setLider({ ...filas[0], titulos: palmares[filas[0].jugador] || 0 });
        }
      }
      setLoading(false);
    })();
  }, []);

  const abiertas = porras.filter((p) => !estaCerrada(p) && !p.cerrada);
  const cerradas = porras.filter((p) => estaCerrada(p) || p.cerrada);
  const nombrePorra = (p) => p.tipo === "partido" ? `${p.local} - ${p.visitante}` : (p.sede || p.comp);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 0 80px", animation: "fadeIn .5s ease both" }}>
      {/* HERO */}
      <div style={{
        position: "relative", overflow: "hidden", padding: "48px 24px 40px",
        background: `radial-gradient(120% 100% at 50% 0%, rgba(124,92,240,0.35), transparent 60%), linear-gradient(180deg, ${C.panelSolid}, ${C.bg})`,
        borderBottom: `1px solid ${C.panelBorder}`,
      }}>
        {/* destellos decorativos */}
        <div style={{ position: "absolute", top: -60, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(252,211,77,0.15), transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: -80, left: -40, width: 240, height: 240, borderRadius: "50%", background: "radial-gradient(circle, rgba(183,148,255,0.15), transparent 70%)" }} />
        <div style={{ position: "relative", textAlign: "center" }}>
          <img src="/logo.png" alt="La Hoja De Mis Apuestas"
            style={{ width: "min(74%, 300px)", height: "auto", display: "block", margin: "0 auto 10px" }} />
          <h1 style={{
            fontFamily: display, fontWeight: 800, fontSize: 40, letterSpacing: "-0.02em", lineHeight: 1.05, margin: 0,
            background: `linear-gradient(135deg, #fff, ${C.accent})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
          }}>La Hoja De Mis Apuestas</h1>
          <div style={{ color: C.muted, fontSize: 13, fontFamily: mono, marginTop: 10 }}>
            {temporada ? `// temporada ${temporada.nombre}` : "// porras del grupo"}
          </div>

          {/* Líder actual */}
          {lider && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10, marginTop: 22, padding: "10px 18px",
              background: "rgba(252,211,77,0.1)", border: `1px solid rgba(252,211,77,0.3)`, borderRadius: 14,
            }}>
              <span style={{ fontSize: 22 }}>👑</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 10, color: C.gold, textTransform: "uppercase", letterSpacing: "1px" }}>Líder</div>
                <div style={{ fontFamily: display, fontWeight: 700, fontSize: 17 }}>
                  {lider.jugador} {lider.titulos > 0 && "⭐".repeat(lider.titulos)}
                  <span style={{ color: C.gold, marginLeft: 8 }}>{lider.pt} pts</span>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 26, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <Link to="/clasificacion" style={{ ...styles.btnPrimary, textDecoration: "none", display: "inline-block", padding: "14px 28px" }}>📊 Ver clasificación completa</Link>
            <Link to="/estadisticas" style={{ ...styles.btnGhost, textDecoration: "none", display: "inline-block", padding: "14px 28px" }}>🔮 Estadísticas y rachas</Link>
            <Link to="/salon" style={{ ...styles.btnGhost, textDecoration: "none", display: "inline-block", padding: "14px 28px" }}>🏛️ Salón de la Fama</Link>
          </div>
        </div>
      </div>

      <InstalarApp />

      <div style={{ padding: "24px 18px" }}>
        {loading ? <Spinner /> : (
          <>
            {/* Porras abiertas */}
            {abiertas.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <SeccionTitulo emoji="🔴" texto="Votación abierta" />
                {abiertas.map((p) => (
                  <PorraCard key={p.id} p={p} nombre={nombrePorra(p)} cta="Votar ahora →" destacada />
                ))}
              </div>
            )}

            {/* Histórico de la temporada */}
            <div>
              <SeccionTitulo emoji="📋" texto="Porras de la temporada" />
              {cerradas.length === 0 && abiertas.length === 0 && (
                <p style={{ opacity: 0.6, fontSize: 13 }}>Aún no hay porras esta temporada.</p>
              )}
              {cerradas.slice(0, verN).map((p) => (
                <PorraCard key={p.id} p={p} nombre={nombrePorra(p)} cta="Ver votos →" />
              ))}
              {cerradas.length > verN && (
                <button onClick={() => setVerN(verN + 10)} style={{
                  width: "100%", padding: "12px", marginTop: 4, borderRadius: 14, cursor: "pointer",
                  background: "rgba(183,148,255,0.08)", border: `1px dashed ${C.panelBorder}`,
                  color: C.accent, fontSize: 13, fontWeight: 600,
                }}>Ver 10 más ({cerradas.length - verN} restantes) ↓</button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Acceso discreto a Admin */}
      <Link to="/admin" title="Administración" style={{
        position: "fixed", top: 14, right: 14, zIndex: 50, width: 42, height: 42, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
        background: "rgba(124,92,196,0.15)", border: `1px solid ${C.panelBorder}`, color: C.muted,
        fontSize: 20, backdropFilter: "blur(8px)",
      }}>⚙</Link>
    </div>
  );
}

function SeccionTitulo({ emoji, texto }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <h2 style={{ fontFamily: display, fontWeight: 700, fontSize: 18, margin: 0 }}>{texto}</h2>
    </div>
  );
}

function PorraCard({ p, nombre, cta, destacada }) {
  return (
    <Link to={`/votar/${p.id}`} style={{
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
      padding: "14px 16px", marginBottom: 10, borderRadius: 14, textDecoration: "none", color: C.ink,
      background: destacada ? "rgba(251,113,133,0.08)" : C.panel,
      border: `1px solid ${destacada ? "rgba(251,113,133,0.3)" : C.panelBorder}`,
      transition: "transform .15s",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: C.muted, fontFamily: mono }}>{p.jornada != null ? `#${p.jornada}` : "★ Especial"} · {p.comp}</div>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nombre}</div>
      </div>
      <span style={{ color: destacada ? C.red : C.accent, fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>{cta}</span>
    </Link>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/votar/:id" element={<Votar />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/clasificacion" element={<Clasificacion />} />
      <Route path="/estadisticas" element={<PaginaStats />} />
      <Route path="/salon" element={<SalonFama />} />
    </Routes>
  );
}
