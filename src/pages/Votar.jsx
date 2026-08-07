import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { getParticipantes, recomponerClasificacion } from "../lib/temporadas.js";
import { getEquipo } from "../lib/equipos.js";
import { estaCerrada, formatoMadrid, tiempoRestante } from "../lib/tiempo.js";
import { C, display, styles } from "../lib/theme.js";
import { Card, Label, Msg, Stepper, Spinner, Shell, Confetti } from "../components/ui.jsx";

export default function Votar() {
  const { id } = useParams();
  const [porra, setPorra] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [l, setL] = useState(1);
  const [v, setV] = useState(1);
  const [pasa, setPasa] = useState("");
  const [resp, setResp] = useState([]);
  const [msg, setMsg] = useState(null);
  const [votosPublicos, setVotosPublicos] = useState(null);
  const [escudos, setEscudos] = useState({ local: null, visitante: null });
  const [restante, setRestante] = useState(null);
  const [confeti, setConfeti] = useState(0);
  const [guardado, setGuardado] = useState(false);
  const [misStats, setMisStats] = useState(null);
  const [pendientes, setPendientes] = useState([]);
  const [autoCargado, setAutoCargado] = useState(""); // jugador ya auto-cargado
  const [verPin, setVerPin] = useState(false);
  const [recordar, setRecordar] = useState(() => {
    try { return localStorage.getItem("lhdma_recordar") === "1"; } catch { return false; }
  });
  const [paseIda, setPaseIda] = useState(undefined); // undefined = sin consultar

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("porras").select("*").eq("id", id).single();
      if (error || !data) { setMsg(["err", "No se encontró esta porra."]); }
      else {
        setPorra(data);
        setPasa(data.local || "");
        if (data.tipo === "especial") setResp((data.predicciones || []).map(() => ""));
        setParticipantes(await getParticipantes(data.temporada_id));
        if (data.tipo === "partido") {
          const [eqL, eqV] = await Promise.all([getEquipo(data.local), getEquipo(data.visitante)]);
          setEscudos({ local: eqL?.escudo_url || null, visitante: eqV?.escudo_url || null });
        }
        // si está cerrada, cargar los votos de todos para mostrarlos
        if (estaCerrada(data)) {
          const { data: vs } = await supabase.from("votos").select("*").eq("porra_id", data.id);
          setVotosPublicos(vs || []);
        }
      }
      setLoading(false);
    })();
  }, [id]);

  // Recuperar nombre y PIN guardados en este dispositivo
  useEffect(() => {
    try {
      if (localStorage.getItem("lhdma_recordar") !== "1") return;
      const n = localStorage.getItem("lhdma_nombre") || "";
      const p = localStorage.getItem("lhdma_pin") || "";
      if (n) setName(n);
      if (p) setPin(p);
    } catch { /* ignora */ }
  }, []);

  // Guardar (o borrar) según la casilla
  useEffect(() => {
    try {
      if (recordar) {
        localStorage.setItem("lhdma_recordar", "1");
        if (name) localStorage.setItem("lhdma_nombre", name);
        if (pin && pin.length === 4) localStorage.setItem("lhdma_pin", pin);
      } else {
        localStorage.removeItem("lhdma_recordar");
        localStorage.removeItem("lhdma_nombre");
        localStorage.removeItem("lhdma_pin");
      }
    } catch { /* ignora */ }
  }, [recordar, name, pin]);

  // Cuenta atrás de cierre (se refresca cada minuto)
  useEffect(() => {
    if (!porra?.cierra_en) return;
    const upd = () => setRestante(tiempoRestante(porra.cierra_en));
    upd();
    const t = setInterval(upd, 30000);
    return () => clearInterval(t);
  }, [porra?.cierra_en]);

  // Auto-carga: al completar nombre + PIN correcto, carga el voto existente sin pulsar nada.
  useEffect(() => {
    if (!porra || !name || pin.length < 4) return;
    const p = participantes.find((x) => x.nombre === name);
    if (!p || p.pin !== pin) return;
    if (autoCargado === name) return; // ya cargado para este jugador
    setAutoCargado(name);
    (async () => {
      cargarContextoJugador(name);
      // si es la VUELTA de una eliminatoria, recuperamos el pase que votó en la ida
      if (porra.ida_id) {
        const { data: vIda } = await supabase.from("votos").select("contenido")
          .eq("porra_id", porra.ida_id).eq("jugador", name).maybeSingle();
        setPaseIda(vIda?.contenido?.pasa || null);
      }
      const { data } = await supabase.from("votos").select("*").eq("porra_id", porra.id).eq("jugador", name).maybeSingle();
      if (!data) { setMsg(["ok", "PIN correcto. Aún no has votado: rellena tu pronóstico y guarda."]); return; }
      const c = data.contenido;
      if (porra.tipo === "partido") { setL(c.local); setV(c.visitante); if (c.pasa) setPasa(c.pasa); }
      else if (porra.modo === "aproximacion") setResp([c.digito]);
      else setResp(c.resp);
      setMsg(["ok", "Este es tu voto actual. Puedes modificarlo y volver a guardar."]);
    })();
  }, [name, pin, participantes, porra]); // eslint-disable-line

  if (loading) return <Shell title="Porra"><Spinner /></Shell>;
  if (!porra) return <Shell title="Porra"><Card><Msg m={msg} /></Card></Shell>;
  if (estaCerrada(porra)) return <VotosPublicos porra={porra} votos={votosPublicos} participantes={participantes} />;

  // Tras identificarse: carga su posición/puntos y otras porras abiertas sin votar
  // Valida el PIN contra la base de datos y controla los intentos fallidos.
  // Devuelve { ok } | { bloqueado } | { fallo, restantes }
  const validarPin = async (jugador, pinIntro) => {
    const { data: p } = await supabase.from("participantes").select("*")
      .eq("temporada_id", porra.temporada_id).eq("nombre", jugador).maybeSingle();
    if (!p) return { fallo: true, restantes: null };
    if (p.bloqueado) return { bloqueado: true };
    if (p.pin === pinIntro) {
      if ((p.intentos_fallidos || 0) > 0) {
        await supabase.from("participantes").update({ intentos_fallidos: 0 }).eq("id", p.id);
      }
      return { ok: true };
    }
    const n = (p.intentos_fallidos || 0) + 1;
    const bloquear = n >= 5;
    await supabase.from("participantes").update({ intentos_fallidos: n, bloqueado: bloquear }).eq("id", p.id);
    return bloquear ? { bloqueado: true } : { fallo: true, restantes: 5 - n };
  };

  const cargarContextoJugador = async (jugador) => {
    try {
      const filas = await recomponerClasificacion(porra.temporada_id);
      const idx = filas.findIndex((f) => f.jugador === jugador);
      if (idx >= 0) setMisStats({ pos: idx + 1, total: filas.length, pt: filas[idx].pt });
      // porras abiertas de la temporada
      const { data: abiertas } = await supabase.from("porras").select("*").eq("temporada_id", porra.temporada_id).eq("cerrada", false);
      const ahora = Date.now();
      const noVotadas = [];
      for (const pr of (abiertas || [])) {
        if (pr.id === porra.id) continue;
        if (pr.cierra_en && new Date(pr.cierra_en).getTime() <= ahora) continue; // votación cerrada por fecha
        const { data: voto } = await supabase.from("votos").select("jugador").eq("porra_id", pr.id).eq("jugador", jugador).maybeSingle();
        if (!voto) noVotadas.push(pr);
      }
      setPendientes(noVotadas);
    } catch { /* silencioso */ }
  };

  const cargarMiVoto = async () => {
    if (!name) { setMsg(["err", "Elige tu nombre primero."]); return; }
    const p = participantes.find((x) => x.nombre === name);
    const val = await validarPin(name, pin);
    if (val.bloqueado) { setMsg(["err", "🔒 Acceso bloqueado por PINs fallidos. Pide al administrador que te desbloquee."]); return; }
    if (!val.ok) { setMsg(["err", `PIN incorrecto.${val.restantes != null ? ` Te quedan ${val.restantes} intentos.` : ""}`]); return; }
    cargarContextoJugador(name);
    const { data } = await supabase.from("votos").select("*").eq("porra_id", porra.id).eq("jugador", name).maybeSingle();
    if (!data) { setMsg(["err", "Aún no has votado en esta porra."]); return; }
    const c = data.contenido;
    if (porra.tipo === "partido") { setL(c.local); setV(c.visitante); if (c.pasa) setPasa(c.pasa); }
    else if (porra.modo === "aproximacion") setResp([c.digito]);
    else setResp(c.resp);
    setMsg(["ok", "Voto cargado. Puedes modificarlo y volver a guardar."]);
  };

  const enviar = async () => {
    if (estaCerrada(porra)) { setMsg(["err", "La votación ya está cerrada."]); return; }
    if (!name) { setMsg(["err", "Elige tu nombre."]); return; }
    if (pin.length < 4) { setMsg(["err", "El PIN debe tener 4 dígitos."]); return; }
    const p = participantes.find((x) => x.nombre === name);
    if (!p) { setMsg(["err", "Participante no válido."]); return; }
    const val = await validarPin(name, pin);
    if (val.bloqueado) { setMsg(["err", "🔒 Acceso bloqueado por PINs fallidos. Pide al administrador que te desbloquee."]); return; }
    if (!val.ok) { setMsg(["err", `PIN incorrecto.${val.restantes != null ? ` Te quedan ${val.restantes} intentos.` : ""}`]); return; }

    let contenido;
    if (porra.tipo === "partido") {
      contenido = { local: +l, visitante: +v, pasa: (porra.eliminatoria && !porra.ida_id) ? pasa : null };
    } else if (porra.modo === "aproximacion") {
      if (resp[0] === "" || resp[0] == null) { setMsg(["err", "Elige una terminación (0–9)."]); return; }
      contenido = { digito: Number(resp[0]) };
    } else {
      const preds = (porra.predicciones || []).map((p) => typeof p === "string" ? { tipo: "opcion" } : p);
      for (let i = 0; i < preds.length; i++) {
        const p = preds[i], r = resp[i];
        if (p.tipo === "equipo_puesto") {
          const n = (p.puestos || []).length;
          if (!Array.isArray(r) || r.filter((x) => x && x.trim()).length < n) { setMsg(["err", "Asigna un equipo a cada puesto."]); return; }
        } else if (p.tipo === "numero") {
          if (r === "" || r == null || isNaN(Number(r))) { setMsg(["err", "Pon un número en todas las predicciones numéricas."]); return; }
        } else {
          if (!r || !String(r).trim()) { setMsg(["err", "Responde todas las predicciones."]); return; }
        }
      }
      contenido = { resp: [...resp] };
    }
    const { error } = await supabase.from("votos").upsert(
      { porra_id: porra.id, jugador: name, contenido },
      { onConflict: "porra_id,jugador" }
    );
    if (error) setMsg(["err", "Error al guardar: " + error.message]);
    else {
      setMsg(["ok", "¡Voto guardado! Puedes cerrar la página."]);
      setGuardado(true);
      setConfeti((n) => n + 1);
      cargarContextoJugador(name);
    }
  };

  return (
    <Shell title={porra.tipo === "especial" ? (porra.sede || porra.comp) : `Porra ${porra.jornada}`} sub={porra.comp}>
      <Confetti fire={confeti} />
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => window.history.length > 1 ? window.history.back() : (window.location.href = "/")}
          style={{ ...styles.btnGhost, flex: 1 }}>← Atrás</button>
        <Link to="/" style={{ ...styles.btnGhost, flex: 1, textAlign: "center", textDecoration: "none" }}>🏠 Inicio</Link>
      </div>
      {porra.tipo === "partido" && (
        <div style={{ background: `linear-gradient(135deg, rgba(124,92,196,0.25), rgba(45,27,84,0.5))`, borderRadius: 12, padding: 18, marginBottom: 16, textAlign: "center", border: `1px solid ${C.line}` }}>
          {porra.sede && <div style={{ fontSize: 11, opacity: 0.7 }}>{porra.sede}</div>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 8 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
              {escudos.local
                ? <img src={escudos.local} alt={porra.local} style={{ width: 56, height: 56, objectFit: "contain" }} />
                : <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(183,148,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🛡️</div>}
              <span style={{ fontFamily: display, fontSize: 14 }}>{porra.local}</span>
            </div>
            <span style={{ color: C.accent, fontSize: 20, fontWeight: 700 }}>VS</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
              {escudos.visitante
                ? <img src={escudos.visitante} alt={porra.visitante} style={{ width: 56, height: 56, objectFit: "contain" }} />
                : <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(183,148,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🛡️</div>}
              <span style={{ fontFamily: display, fontSize: 14 }}>{porra.visitante}</span>
            </div>
          </div>
        </div>
      )}

      {/* Cuenta atrás de cierre */}
      {restante && restante !== "cerrada" && (
        <div style={{ textAlign: "center", marginBottom: 12, padding: "8px 12px", background: "rgba(251,113,133,0.1)", border: `1px solid rgba(251,113,133,0.3)`, borderRadius: 10, fontSize: 13 }}>
          ⏳ Cierra en <b style={{ color: C.red }}>{restante}</b>
        </div>
      )}

      <Card>
        <Label>Tu nombre</Label>
        <select value={name} onChange={(e) => setName(e.target.value)} style={styles.inp}>
          <option value="">— elige —</option>
          {participantes.map((p) => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
        </select>
        <Label>PIN (4 dígitos)</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type={verPin ? "text" : "password"} inputMode="numeric" autoComplete="off"
            value={pin} maxLength={4} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••" style={{ ...styles.inp, flex: 1 }} />
          <button onClick={() => setVerPin(!verPin)} title={verPin ? "Ocultar" : "Ver"}
            style={{ ...styles.btnGhost, padding: "10px 12px" }}>{verPin ? "🙈" : "👁"}</button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.muted, marginTop: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={recordar} onChange={(e) => setRecordar(e.target.checked)} />
          Recordar mi nombre y PIN en este dispositivo
        </label>
        <button onClick={cargarMiVoto} style={{ ...styles.btnGhost, marginTop: 8 }}>Cargar mi voto anterior (para modificarlo)</button>
        {porra.cierra_en && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 8 }}>Puedes votar y cambiar tu voto hasta el {formatoMadrid(porra.cierra_en)} (hora española).</div>}

        {porra.tipo === "partido" ? (
          <>
            <Label>Tu resultado</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", margin: "8px 0 4px" }}>
              <Stepper label={porra.local} value={l} set={setL} />
              <span style={{ fontSize: 24, opacity: 0.5 }}>—</span>
              <Stepper label={porra.visitante} value={v} set={setV} />
            </div>
            {porra.eliminatoria && !porra.ida_id && (
              <>
                <Label>¿Quién pasa/gana? (+1 punto extra)</Label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[porra.local, porra.visitante].map((t) => (
                    <button key={t} onClick={() => setPasa(t)} style={styles.pill(pasa === t)}>{t}</button>
                  ))}
                </div>
              </>
            )}
            {porra.ida_id && paseIda !== undefined && (
              <div style={{
                marginTop: 12, padding: "10px 12px", borderRadius: 10,
                background: "rgba(183,148,255,0.08)", border: `1px solid ${C.line}`,
              }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>Quién pasa (votado en la ida, ya no se puede cambiar)</div>
                {paseIda
                  ? <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>🔒 {paseIda}</div>
                  : <div style={{ fontSize: 13, color: C.muted }}>No votaste el pase en la ida.</div>}
              </div>
            )}
          </>
        ) : porra.modo === "aproximacion" ? (
          <>
            <div style={{ fontSize: 11, opacity: 0.7, margin: "10px 0" }}>
              Elige la terminación (último dígito). {porra.puntos_acierto} pts si aciertas ({porra.puntos_unico} si único) · {porra.puntos_aprox ?? 1} si te quedas a uno.
            </div>
            <Label>Terminación</Label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[0,1,2,3,4,5,6,7,8,9].map((d) => (
                <button key={d} onClick={() => setResp([d])} style={{ ...styles.pill(resp[0] === d), flex: "0 0 auto", width: 42 }}>{d}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, opacity: 0.7, margin: "10px 0" }}>
              {(() => {
                const pr = (porra.predicciones || [])[0];
                const c = typeof pr === "string" ? {} : (pr || {});
                const ex = c.puntos_exacto ?? porra.puntos_acierto;
                const exU = c.puntos_unico_exacto ?? porra.puntos_unico;
                const ap = c.puntos_aprox ?? porra.puntos_aprox;
                const apU = c.puntos_unico_aprox ?? ap;
                const apExt = c.puntos_aprox_ext;
                return <>
                  Acierto exacto: {ex} pts{exU != null && exU !== ex ? ` (${exU} si único)` : ""}
                  {ap > 0 ? <> · en otro puesto: {ap} pts{apU != null && apU !== ap ? ` (${apU} si único)` : ""}</> : null}
                  {apExt > 0 ? <> · equipo de aproximación: {apExt} pts</> : null}
                </>;
              })()}
            </div>
            {(porra.predicciones || []).map((pred, i) => {
              const p = typeof pred === "string" ? { texto: pred, tipo: "opcion", opciones: [] } : pred;
              return (
                <div key={i} style={{ marginBottom: 12 }}>
                  <Label>{p.texto}</Label>
                  {p.tipo === "opcion" && (
                    (p.opciones && p.opciones.length > 0) ? (
                      <select value={resp[i] || ""} onChange={(e) => { const c = [...resp]; c[i] = e.target.value; setResp(c); }} style={styles.inp}>
                        <option value="">— elige —</option>
                        {p.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input value={resp[i] || ""} onChange={(e) => { const c = [...resp]; c[i] = e.target.value; setResp(c); }} placeholder="Tu respuesta" style={styles.inp} />
                    )
                  )}
                  {p.tipo === "numero" && (
                    <input type="number" value={resp[i] ?? ""} onChange={(e) => { const c = [...resp]; c[i] = e.target.value; setResp(c); }} placeholder="Tu número" style={styles.inp} />
                  )}
                  {p.tipo === "equipo_puesto" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {(p.puestos || []).map((puesto, s) => (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ minWidth: 50, fontSize: 13, color: C.accent, fontWeight: 600 }}>{puesto}</span>
                          <select value={(resp[i] && resp[i][s]) || ""} onChange={(e) => {
                            const c = [...resp];
                            const arr = Array.isArray(c[i]) ? [...c[i]] : [];
                            arr[s] = e.target.value; c[i] = arr; setResp(c);
                          }} style={{ ...styles.inp, flex: 1 }}>
                            <option value="">— equipo —</option>
                            {(p.opciones || []).map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        <button onClick={enviar} style={{ ...styles.btnPrimary, marginTop: 18 }}>GUARDAR VOTO</button>
        <Msg m={msg} />

        {misStats && (
          <div style={{ marginTop: 12, padding: 12, background: "rgba(252,211,77,0.08)", border: `1px solid rgba(252,211,77,0.25)`, borderRadius: 10, textAlign: "center", fontSize: 13 }}>
            Vas <b style={{ color: C.gold }}>{misStats.pos}º</b> de {misStats.total} · <b>{misStats.pt}</b> pts
          </div>
        )}

        {guardado && pendientes.length > 0 && (
          <div style={{ marginTop: 12, padding: 12, background: "rgba(251,113,133,0.1)", border: `1px solid rgba(251,113,133,0.35)`, borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: C.red, fontWeight: 600, marginBottom: 8 }}>⚠ Te quedan {pendientes.length} porra(s) por votar:</div>
            {pendientes.map((pr) => (
              <Link key={pr.id} to={`/votar/${pr.id}`} onClick={() => window.scrollTo(0, 0)} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.line}`, textDecoration: "none", color: C.ink, fontSize: 13 }}>
                <span>{pr.tipo === "partido" ? `${pr.local} - ${pr.visitante}` : (pr.sede || pr.comp)}</span>
                <span style={{ color: C.accent }}>Votar →</span>
              </Link>
            ))}
          </div>
        )}

        <Link to="/clasificacion" style={{ ...styles.btnGhost, display: "block", textAlign: "center", textDecoration: "none", marginTop: 10 }}>📊 Ver clasificación</Link>
      </Card>
    </Shell>
  );
}

// Vista pública cuando la porra está cerrada: muestra qué votó cada uno.
function VotosPublicos({ porra, votos, participantes = [] }) {
  const formatVoto = (v) => {
    const c = v.contenido || {};
    if (porra.tipo === "partido") {
      let s = `${c.local} - ${c.visitante}`;
      if (c.pasa) s += ` · pasa ${c.pasa}`;
      return s;
    }
    if (porra.modo === "aproximacion") return `Terminación: ${c.digito}`;
    // especial: respuestas según tipo
    const preds = (porra.predicciones || []).map((p) => typeof p === "string" ? { texto: p, tipo: "opcion" } : p);
    return (c.resp || []).map((r, i) => {
      const p = preds[i] || { texto: `P${i + 1}`, tipo: "opcion" };
      if (p.tipo === "equipo_puesto" && Array.isArray(r)) {
        const detalle = (p.puestos || []).map((pu, s) => `${pu} ${r[s] || "—"}`).join(", ");
        return `${p.texto}: ${detalle}`;
      }
      return `${p.texto}: ${r}`;
    }).join(" · ");
  };

  return (
    <Shell title={porra.tipo === "especial" ? (porra.sede || porra.comp) : `Porra ${porra.jornada}`} sub={porra.comp}>
      <Card>
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          La votación está <b style={{ color: C.gold }}>cerrada</b>.
          {porra.cierra_en && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Cerró el {formatoMadrid(porra.cierra_en)} (hora española).</div>}
        </div>
        {porra.tipo === "partido" && (
          <div style={{ textAlign: "center", fontFamily: display, fontSize: 18, marginBottom: 14 }}>
            {porra.local} <span style={{ color: C.accent }}>vs</span> {porra.visitante}
          </div>
        )}
        {(() => {
          const votaron = new Set((votos || []).map((v) => v.jugador));
          const sinVotar = participantes.filter((p) => !votaron.has(p.nombre));
          return (
            <>
              <Label>Votos de los participantes ({(votos || []).length}{participantes.length ? ` de ${participantes.length}` : ""})</Label>
              {(!votos || votos.length === 0)
                ? <p style={{ opacity: 0.6, fontSize: 13 }}>No hay votos registrados.</p>
                : votos.slice().sort((a, b) => a.jugador.localeCompare(b.jugador, "es")).map((v) => (
                  <div key={v.jugador} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 14 }}>
                    <b>{v.jugador}</b>
                    <span style={{ color: C.accent, textAlign: "right" }}>{formatVoto(v)}</span>
                  </div>
                ))}
              {sinVotar.length > 0 && (
                <>
                  <div style={{ fontSize: 12, color: C.red, marginTop: 14, marginBottom: 4 }}>
                    No votaron en esta porra ({sinVotar.length}):
                  </div>
                  {sinVotar.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((p) => (
                    <div key={p.id || p.nombre} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.line}`, fontSize: 14, opacity: 0.65 }}>
                      <b>{p.nombre}</b>
                      <span style={{ color: C.red, fontSize: 12 }}>— no votó —</span>
                    </div>
                  ))}
                </>
              )}
            </>
          );
        })()}
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 12 }}>Los puntos se calcularán cuando se publique el resultado.</div>
        <Link to="/clasificacion" style={{ ...styles.btnGhost, display: "block", textAlign: "center", textDecoration: "none", marginTop: 12 }}>📊 Ver clasificación</Link>
      </Card>
    </Shell>
  );
}
