import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { C, mono, display, styles } from "../lib/theme.js";
import { Card, SectionTitle, Label, Msg, Stepper, Shell, Spinner, Plegable, SelectOEscribe } from "../components/ui.jsx";
import TablaClasificacion from "../components/TablaClasificacion.jsx";
import CompartirImagen from "../components/CompartirImagen.jsx";
import { listarImagenes, borrarImagen } from "../lib/galeria.js";
import { computePartido, computeEspecial, computeAproximacion } from "../lib/scoring.js";
import { getTemporadaActiva, listarTemporadas, nuevaTemporada, getParticipantes,
  renombrarTemporada, marcarCampeon, borrarTemporada, getClasificacionTemporada,
  actualizarFilaClasificacion, getPorrasTemporada, recomponerClasificacion,
  descalcularPorra, borrarPorra, getSugerenciasPorra, getResultadoPorra, getPalmares, getMovimientos } from "../lib/temporadas.js";
import { listarEquipos, guardarEquipo, getEquipo, guardarEquiposEnLote, subirCabecera } from "../lib/equipos.js";
import { generarPromo, generarPromoEspecial, descargarDataUrl } from "../lib/promo.js";
import { generarImagenResultados, generarImagenVotos } from "../lib/imagenResultados.js";
import HistoricoTemporadas from "../components/HistoricoTemporadas.jsx";
import RachasJugadores, { DestacadosRachas } from "../components/RachasJugadores.jsx";
import Estadisticas from "../components/Estadisticas.jsx";
import { inputMadridAUTC, formatoMadrid, utcAInputMadrid, estaCerrada } from "../lib/tiempo.js";
import { descargarBackup } from "../lib/backup.js";

const ADMIN_PW = import.meta.env.VITE_ADMIN_PASSWORD;

export default function Admin() {
  // La sesión de admin se recuerda mientras la pestaña siga abierta,
  // para no tener que reescribir la contraseña al ir y volver.
  const [authed, setAuthed] = useState(() => {
    try { return sessionStorage.getItem("lhdma_admin") === "1"; } catch { return false; }
  });
  const entrar = (valida) => {
    setAuthed(valida);
    try { if (valida) sessionStorage.setItem("lhdma_admin", "1"); } catch { /* ignora */ }
  };
  const salir = () => {
    try { sessionStorage.removeItem("lhdma_admin"); } catch { /* ignora */ }
    setAuthed(false);
  };
  const [pw, setPw] = useState("");
  if (!authed) {
    return (
      <Shell title="Admin">
        <Link to="/" style={{ ...styles.btnGhost, display: "inline-block", textDecoration: "none", marginBottom: 16 }}>← Inicio</Link>
        <Card>
          <Label>Contraseña de administración</Label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={styles.inp} />
          <button style={{ ...styles.btnPrimary, marginTop: 14 }}
            onClick={() => entrar(pw === ADMIN_PW && !!ADMIN_PW)}>ENTRAR</button>
          {pw && pw !== ADMIN_PW && <Msg m={["err", "Contraseña incorrecta."]} />}
        </Card>
      </Shell>
    );
  }
  return <Panel />;
}

function Panel() {
  const [activa, setActiva] = useState(null);
  const [loading, setLoading] = useState(true);
  const [porras, setPorras] = useState([]);
  const [sel, setSel] = useState(null);
  const [msg, setMsg] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [tab, setTab] = useState("porras");

  // El botón atrás del móvil debe cerrar la vista actual (porra o pestaña),
  // no salir del panel y volver a pedir la contraseña.
  const marcarPaso = () => { try { window.history.pushState({ lhdma: true }, ""); } catch { /* ignora */ } };
  const cambiarTab = (id) => { if (id !== tab) { marcarPaso(); setTab(id); } };
  const abrirPorra = (p) => { marcarPaso(); setSel(p); };
  useEffect(() => {
    const alVolver = () => {
      if (sel) setSel(null);
      else if (tab !== "porras") setTab("porras");
    };
    window.addEventListener("popstate", alVolver);
    return () => window.removeEventListener("popstate", alVolver);
  }, [sel, tab]);

  const porrasFiltradas = porras.filter((p) => {
    if (!filtro.trim()) return true;
    const f = filtro.toLowerCase();
    return String(p.jornada).includes(f) || (p.comp || "").toLowerCase().includes(f);
  });

  const recargarEquipos = async () => setEquipos(await listarEquipos());

  const recargar = async () => {
    const t = await getTemporadaActiva();
    setActiva(t);
    if (t) {
      const { data } = await supabase.from("porras").select("*").eq("temporada_id", t.id).order("jornada", { ascending: false });
      setPorras(data || []);
      // Si hay una porra abierta en gestión, refrescarla también: si no, seguiría
      // usándose la versión antigua (por ejemplo, con los puntos de antes de editarla).
      setSel((actualSel) => actualSel ? ((data || []).find((p) => p.id === actualSel.id) || actualSel) : actualSel);
    }
    setLoading(false);
  };
  useEffect(() => { recargar(); recargarEquipos(); }, []);

  if (loading) return <Shell title="Admin"><Spinner /></Shell>;

  // Si hay una porra seleccionada, vista aparte (oculta todo lo demás)
  if (sel) {
    return (
      <Shell title="Gestionar porra" sub={`#${sel.jornada} · ${sel.comp}`}>
        <button style={{ ...styles.btnGhost, marginBottom: 16 }} onClick={() => { setSel(null); recargar(); }}>← Volver a porras</button>
        <GestionPorra porra={sel} temporada={activa} onChange={recargar} equipos={equipos} />
      </Shell>
    );
  }

  const tabs = activa
    ? [["porras", "Porras"], ["equipos", "Equipos"], ["gente", "Participantes"], ["rachas", "Rachas"], ["stats", "Stats"], ["historico", "Histórico"], ["galeria", "Imágenes"], ["temporada", "Temporada"], ["guia", "Guía"]]
    : [["temporada", "Temporada"], ["guia", "Guía"]];

  return (
    <Shell title="Admin" sub={activa ? `Temporada ${activa.nombre}` : "Sin temporada activa"}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <Link to="/" style={{ ...styles.btnGhost, textDecoration: "none" }}>← Inicio</Link>
      </div>

      {/* Pestañas */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => cambiarTab(id)} style={{
            padding: "8px 14px", borderRadius: 10, border: `1px solid ${tab === id ? C.accent : C.panelBorder}`,
            background: tab === id ? "linear-gradient(135deg, #b794ff, #7c5cf0)" : "transparent",
            color: tab === id ? "#fff" : C.muted, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: display,
          }}>{label}</button>
        ))}
      </div>

      <Msg m={msg} />

      {!activa && <GestionTemporada activa={activa} onChange={recargar} setMsg={setMsg} />}

      {activa && tab === "porras" && (
        <>
          <PendientesAdmin temporada={activa} porras={porras} onIr={(p) => abrirPorra(p)} />
          <CrearPorra temporada={activa} onCreada={recargar} setMsg={setMsg} equipos={equipos} porras={porras} />
          <CrearEnBloque temporada={activa} onCreadas={recargar} setMsg={setMsg} porras={porras} />
          <Card>
            <SectionTitle>Porras de esta temporada</SectionTitle>
            {porras.length > 4 && (
              <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por jornada o competición…"
                style={{ ...styles.inp, marginBottom: 12 }} />
            )}
            {porras.length === 0 && <p style={{ opacity: 0.6, fontSize: 13 }}>Aún no hay porras.</p>}
            {porrasFiltradas.map((p) => (
              <FilaPorra key={p.id} p={p} onGestionar={() => abrirPorra(p)} onChange={recargar} setMsg={setMsg} temporada={activa} />
            ))}
          </Card>
        </>
      )}
      {activa && tab === "equipos" && <Equipos setMsg={setMsg} equipos={equipos} onChange={recargarEquipos} />}
      {activa && tab === "gente" && <Participantes temporada={activa} setMsg={setMsg} />}
      {activa && tab === "rachas" && <RachasJugadores temporada={activa} />}
      {activa && tab === "stats" && <Estadisticas temporada={activa} />}
      {activa && tab === "historico" && <><Auditoria temporada={activa} /><HistoricoTemporadas setMsg={setMsg} /></>}
      {activa && tab === "temporada" && <GestionTemporada activa={activa} onChange={recargar} setMsg={setMsg} />}
      {activa && tab === "galeria" && <Galeria temporada={activa} setMsg={setMsg} />}
      {tab === "guia" && <GuiaAdmin setMsg={setMsg} />}
    </Shell>
  );
}

function GestionTemporada({ activa, onChange, setMsg }) {
  const [todas, setTodas] = useState([]);
  const [nombre, setNombre] = useState("");
  useEffect(() => { listarTemporadas().then(setTodas); }, [activa]);

  const crear = async () => {
    if (!nombre.trim()) { setMsg(["err", "Pon un nombre de temporada (ej. 2027/2028)."]); return; }
    const { error } = await nuevaTemporada(nombre.trim());
    if (error) setMsg(["err", error.message]);
    else { setMsg(["ok", `Temporada ${nombre} creada y activada. Las anteriores quedan archivadas.`]); setNombre(""); onChange(); }
  };

  return (
    <Plegable titulo="Temporadas (crear nueva — 1 vez al año)">
      {todas.map((t) => (
        <div key={t.id} style={{ fontSize: 13, padding: "2px 0" }}>
          {t.nombre} {t.activa ? <b style={{ color: C.green }}>· activa</b> : <span style={{ opacity: 0.5 }}>· archivada</span>}
        </div>
      ))}
      <div style={{ marginTop: 12, padding: 10, background: C.panelSolid, borderRadius: 8 }}>
        <Label>Empezar nueva temporada (parte de 0; la actual se archiva)</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={styles.inp} placeholder="Ej. 2027/2028" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <button style={styles.btnGhost} onClick={crear}>Crear</button>
        </div>
      </div>
    </Plegable>
  );
}

function Participantes({ temporada, setMsg }) {
  const [lista, setLista] = useState([]);
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(null);
  const [editandoPin, setEditandoPin] = useState(null);
  const [nuevoPin, setNuevoPin] = useState("");

  const recargar = async () => setLista(await getParticipantes(temporada.id));
  useEffect(() => { recargar(); }, [temporada.id]);

  const añadir = async () => {
    if (!nombre.trim() || pin.length < 4) { setMsg(["err", "Nombre y PIN de 4 dígitos."]); return; }
    const { error } = await supabase.from("participantes").insert({ temporada_id: temporada.id, nombre: nombre.trim(), pin });
    if (error) setMsg(["err", error.message.includes("duplicate") ? "Ese nombre ya existe en la temporada." : error.message]);
    else { setNombre(""); setPin(""); recargar(); }
  };
  const quitar = async (id) => { await supabase.from("participantes").delete().eq("id", id); setConfirmandoQuitar(null); recargar(); };
  const desbloquear = async (id, nombre) => {
    const { error } = await supabase.from("participantes").update({ bloqueado: false, intentos_fallidos: 0 }).eq("id", id);
    if (error) setMsg(["err", error.message]);
    else { setMsg(["ok", `${nombre} desbloqueado.`]); recargar(); }
  };

  const guardarPin = async (id) => {
    if (nuevoPin.length < 4) { setMsg(["err", "El PIN debe tener 4 dígitos."]); return; }
    await supabase.from("participantes").update({ pin: nuevoPin }).eq("id", id);
    setMsg(["ok", "PIN actualizado."]); setEditandoPin(null); setNuevoPin(""); recargar();
  };

  return (
    <Plegable titulo={`Participantes (${lista.length})`} abiertoInicial>
      {lista.map((p) => (
        <div key={p.id} style={{ padding: "6px 0", fontSize: 13, borderBottom: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>
              {p.nombre} <span style={{ opacity: 0.4 }}>· PIN {p.pin}</span>
              {p.bloqueado
                ? <span style={{ color: C.red, fontSize: 11, marginLeft: 6 }}>🔒 bloqueado</span>
                : (p.intentos_fallidos > 0 && <span style={{ color: C.gold, fontSize: 11, marginLeft: 6 }}>{p.intentos_fallidos} fallo(s)</span>)}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              {(p.bloqueado || p.intentos_fallidos > 0) && (
                <button style={{ ...styles.btnGhost, padding: "2px 8px", fontSize: 11, color: C.green }}
                  onClick={() => desbloquear(p.id, p.nombre)}>Desbloquear</button>
              )}
              {confirmandoQuitar === p.id ? (
                <>
                  <button style={{ ...styles.btnGhost, color: C.red, fontSize: 11, padding: "4px 8px" }} onClick={() => quitar(p.id)}>Confirmar</button>
                  <button style={{ ...styles.btnGhost, fontSize: 11, padding: "4px 8px" }} onClick={() => setConfirmandoQuitar(null)}>No</button>
                </>
              ) : (
                <>
                  <button style={{ ...styles.btnGhost, opacity: 0.7, fontSize: 11, padding: "4px 8px" }} onClick={() => { setEditandoPin(editandoPin === p.id ? null : p.id); setNuevoPin(p.pin); }}>PIN</button>
                  <button style={{ ...styles.btnGhost, opacity: 0.6, fontSize: 11, padding: "4px 8px" }} onClick={() => setConfirmandoQuitar(p.id)}>quitar</button>
                </>
              )}
            </div>
          </div>
          {editandoPin === p.id && (
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input style={{ ...styles.inp, width: 100 }} maxLength={4} value={nuevoPin} onChange={(e) => setNuevoPin(e.target.value.replace(/\D/g, ""))} placeholder="Nuevo PIN" />
              <button style={styles.btnGhost} onClick={() => guardarPin(p.id)}>Guardar PIN</button>
            </div>
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input style={styles.inp} placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input style={{ ...styles.inp, width: 90 }} placeholder="PIN" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        <button style={styles.btnGhost} onClick={añadir}>+ Añadir</button>
      </div>
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>Puedes editar el PIN de un participante durante la temporada.</div>
    </Plegable>
  );
}

function Equipos({ setMsg, equipos, onChange }) {
  const lista = equipos;
  const [nombre, setNombre] = useState("");
  const [file, setFile] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [lote, setLote] = useState([]);
  const [subiendoLote, setSubiendoLote] = useState(false);
  const [sel, setSel] = useState(null);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoEscudo, setNuevoEscudo] = useState(null);
  const [confBorrar, setConfBorrar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const guardarCambios = async () => {
    if (!nuevoNombre.trim()) { setMsg(["err", "El nombre no puede quedar vacío."]); return; }
    setGuardando(true);
    // guardarEquipo actualiza por nombre; si cambia el nombre, actualizamos la fila directamente
    if (nuevoEscudo) {
      const { error } = await guardarEquipo(nuevoNombre.trim(), nuevoEscudo);
      if (error) { setGuardando(false); setMsg(["err", error.message]); return; }
      if (nuevoNombre.trim() !== sel.nombre) await supabase.from("equipos").delete().eq("id", sel.id);
    } else if (nuevoNombre.trim() !== sel.nombre) {
      const { error } = await supabase.from("equipos").update({ nombre: nuevoNombre.trim() }).eq("id", sel.id);
      if (error) { setGuardando(false); setMsg(["err", error.message]); return; }
    }
    setGuardando(false); setSel(null); setNuevoEscudo(null);
    setMsg(["ok", "Equipo actualizado."]); onChange();
  };

  const borrarEquipo = async () => {
    const { error } = await supabase.from("equipos").delete().eq("id", sel.id);
    setConfBorrar(false);
    if (error) setMsg(["err", error.message]);
    else { setMsg(["ok", `Equipo «${sel.nombre}» borrado.`]); setSel(null); onChange(); }
  };

  const subir = async () => {
    if (!nombre.trim()) { setMsg(["err", "Pon el nombre del equipo."]); return; }
    setSubiendo(true);
    const { error } = await guardarEquipo(nombre, file);
    setSubiendo(false);
    if (error) setMsg(["err", "Error: " + error.message]);
    else { setMsg(["ok", "Equipo guardado."]); setNombre(""); setFile(null); onChange(); }
  };

  const subirLote = async () => {
    if (lote.length === 0) { setMsg(["err", "Elige varios archivos primero."]); return; }
    setSubiendoLote(true);
    const { ok, errores } = await guardarEquiposEnLote(lote);
    setSubiendoLote(false);
    setLote([]);
    if (errores.length) setMsg(["err", `Subidos ${ok}. Errores: ${errores.join(" | ")}`]);
    else setMsg(["ok", `${ok} equipos subidos correctamente.`]);
    onChange();
  };

  return (
    <Plegable titulo={`Equipos y escudos (${lista.length})`} abiertoInicial>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        {lista.map((e) => (
          <div key={e.id} onClick={() => { setSel(sel?.id === e.id ? null : e); setNuevoNombre(e.nombre); setNuevoEscudo(null); setConfBorrar(false); }}
            style={{ textAlign: "center", width: 80, cursor: "pointer", padding: 4, borderRadius: 10,
              border: `1px solid ${sel?.id === e.id ? C.accent : "transparent"}`,
              background: sel?.id === e.id ? "rgba(183,148,255,0.10)" : "transparent" }}>
            {e.escudo_url
              ? <img src={e.escudo_url} alt={e.nombre} style={{ width: 48, height: 48, objectFit: "contain" }} />
              : <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.panelSolid, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, margin: "0 auto" }}>—</div>}
            <div style={{ fontSize: 10, opacity: 0.8, marginTop: 4 }}>{e.nombre}</div>
          </div>
        ))}
      </div>

      {sel && (
        <div style={{ padding: 12, marginBottom: 14, borderRadius: 12, background: "rgba(15,10,32,0.5)", border: `1px solid ${C.panelBorder}` }}>
          <Label>Editar «{sel.nombre}»</Label>
          <input style={styles.inp} value={nuevoNombre} onChange={(ev) => setNuevoNombre(ev.target.value)} placeholder="Nombre del equipo" />
          <div style={{ fontSize: 11, opacity: 0.6, margin: "6px 0 4px" }}>Cambiar el escudo (opcional):</div>
          <input type="file" accept="image/*" onChange={(ev) => setNuevoEscudo(ev.target.files[0])} style={{ ...styles.inp, padding: 8 }} />
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <button style={styles.btnPrimary} onClick={guardarCambios} disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar cambios"}
            </button>
            {confBorrar ? (
              <>
                <button style={{ ...styles.btnGhost, color: C.red }} onClick={borrarEquipo}>Sí, borrar</button>
                <button style={styles.btnGhost} onClick={() => setConfBorrar(false)}>Cancelar</button>
              </>
            ) : (
              <button style={{ ...styles.btnGhost, color: C.red }} onClick={() => setConfBorrar(true)}>🗑 Borrar equipo</button>
            )}
            <button style={styles.btnGhost} onClick={() => setSel(null)}>Cerrar</button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
            Al renombrar, las porras antiguas conservan el nombre con el que se crearon.
          </div>
        </div>
      )}

      <Label>Subir varios de golpe (el nombre del equipo = nombre del archivo)</Label>
      <input type="file" accept="image/*" multiple onChange={(e) => setLote([...e.target.files])} style={{ ...styles.inp, padding: 8 }} />
      {lote.length > 0 && <div style={{ fontSize: 11, color: C.accent, marginTop: 6 }}>{lote.length} archivos: {lote.map((f) => f.name.replace(/\.[^.]+$/, "")).join(", ")}</div>}
      <button style={{ ...styles.btnGhost, marginTop: 10 }} onClick={subirLote} disabled={subiendoLote}>{subiendoLote ? "Subiendo…" : `Subir ${lote.length || ""} escudos`}</button>
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>Ej: un archivo "Real Madrid.png" crea el equipo "Real Madrid".</div>

      <div style={{ borderTop: `1px solid ${C.line}`, margin: "16px 0" }} />

      <Label>Añadir / actualizar uno solo</Label>
      <input style={styles.inp} placeholder="Nombre (ej. Atlético de Madrid)" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} style={{ ...styles.inp, marginTop: 8, padding: 8 }} />
      <button style={{ ...styles.btnGhost, marginTop: 10 }} onClick={subir} disabled={subiendo}>{subiendo ? "Subiendo…" : "Guardar equipo"}</button>
    </Plegable>
  );
}

function CrearPorra({ temporada, onCreada, setMsg, equipos, porras }) {
  const [tipo, setTipo] = useState("partido");
  const [modo, setModo] = useState("exacto");
  const [f, setF] = useState({ jornada: "", comp: "", titulo: "", sede: "", local: "", visitante: "", eliminatoria: false, puntos_acierto: 4, puntos_unico: 5, puntos_aprox: 3 });
  const [cierre, setCierre] = useState("");
  const [cabeceraFile, setCabeceraFile] = useState(null);
  const [elimModo, setElimModo] = useState("aqui"); // 'aqui' | 'ida' | 'vuelta'
  const [idaId, setIdaId] = useState("");
  const idasDisponibles = (porras || []).filter((p) => p.tipo === "partido" && p.eliminatoria);
  const predVacia = () => ({ texto: "", tipo: "opcion", opciones: "", puestos: "", margen: 1, etiqueta_aprox: "", p_exacto: "", p_unico: "", p_aprox: "", p_unico_aprox: "", p_aprox_ext: "", p_unico_aprox_ext: "" });
  const [preds, setPreds] = useState([predVacia()]);
  const [localMsg, setLocalMsg] = useState(null);
  const [sug, setSug] = useState({ comps: [], sedes: [], siguienteJornada: 1 });

  useEffect(() => {
    getSugerenciasPorra(temporada.id).then((s) => {
      setSug(s);
      if (tipo === "partido") setF((prev) => ({ ...prev, jornada: prev.jornada || String(s.siguienteJornada) }));
    });
  }, [temporada.id, porras, tipo]);

  const crear = async () => {
    if (tipo === "partido" && !f.jornada) { setMsg(["err", "Falta la jornada."]); return; }
    if (!f.comp) { setMsg(["err", "Falta la competición."]); return; }
    const reg = { jornada_camp: f.jornada_camp || null, temporada_id: temporada.id, jornada: (tipo === "partido" ? +f.jornada : (f.jornada ? +f.jornada : null)), tipo, comp: f.comp, modo: tipo === "partido" ? "exacto" : modo };
    if (tipo === "partido") {
      Object.assign(reg, { sede: f.sede, local: f.local, visitante: f.visitante, eliminatoria: f.eliminatoria });
      if (f.eliminatoria) {
        if (elimModo === "aqui") reg.pase_aqui = true;
        else if (elimModo === "vuelta") {
          if (!idaId) {
            setMsg(["err", "Has marcado que es la VUELTA: elige su porra de ida. Si no, el pase se pediría otra vez al votar."]);
            setLocalMsg(["err", "Elige la porra de ida correspondiente."]);
            return;
          }
          reg.ida_id = +idaId;
        }
        // 'ida' no necesita nada extra: es eliminatoria y se resolverá en su vuelta
      }
    } else if (modo === "exacto") {
      const num = (v, def) => (v === "" || v == null || isNaN(+v)) ? def : +v;
      if (!f.titulo.trim()) { setMsg(["err", "Ponle un título a la porra."]); setLocalMsg(["err", "Ponle un título a la porra."]); return; }
      // Una sola predicción; su enunciado es el título de la porra.
      const validas = preds.slice(0, 1);
      const predicciones = validas.map((p) => {
        const base = { texto: f.titulo.trim(), tipo: p.tipo,
          puntos_exacto: num(p.p_exacto, +f.puntos_acierto),
          puntos_unico_exacto: num(p.p_unico, +f.puntos_unico),
          puntos_aprox: num(p.p_aprox, +f.puntos_aprox),
          puntos_unico_aprox: num(p.p_unico_aprox, num(p.p_aprox, +f.puntos_aprox)),
          etiqueta_aprox: (p.etiqueta_aprox || "").trim() || null,
          puntos_aprox_ext: num(p.p_aprox_ext, num(p.p_aprox, +f.puntos_aprox)),
          puntos_unico_aprox_ext: num(p.p_unico_aprox_ext, num(p.p_aprox_ext, num(p.p_aprox, +f.puntos_aprox))) };
        if (p.tipo === "opcion") base.opciones = p.opciones.split(",").map((o) => o.trim()).filter(Boolean);
        if (p.tipo === "equipo_puesto") {
          base.opciones = p.opciones.split(",").map((o) => o.trim()).filter(Boolean);
          base.puestos = p.puestos.split(",").map((o) => o.trim()).filter(Boolean);
        }
        if (p.tipo === "numero") base.margen = +p.margen || 0;
        return base;
      });
      // El título separado va en el campo sede (reutilizado) o lo guardamos en comentarios? Usamos columna 'sede' para el título de especiales.
      Object.assign(reg, { predicciones, sede: f.titulo, puntos_acierto: +f.puntos_acierto, puntos_unico: +f.puntos_unico, puntos_aprox: +f.puntos_aprox });
    } else {
      Object.assign(reg, { predicciones: ["Terminación (0–9)"], sede: f.titulo, puntos_acierto: +f.puntos_acierto, puntos_unico: +f.puntos_unico, puntos_aprox: +f.puntos_aprox });
    }
    if (cierre) reg.cierra_en = inputMadridAUTC(cierre);
    // Subir imagen de cabecera si es especial y hay archivo
    if (tipo === "especial" && cabeceraFile) {
      const { url, error: cabErr } = await subirCabecera(cabeceraFile);
      if (cabErr) { setMsg(["err", "Error al subir la imagen: " + cabErr.message]); setLocalMsg(["err", "Error al subir la imagen."]); return; }
      reg.cabecera_url = url;
    }
    const { error } = await supabase.from("porras").insert(reg);
    if (error) { setMsg(["err", error.message]); setLocalMsg(["err", error.message]); }
    else { setMsg(["ok", "Porra creada."]); setLocalMsg(["ok", "Porra creada."]); setCierre(""); setCabeceraFile(null); setF((prev) => ({ ...prev, jornada: String((+prev.jornada || 0) + 1) })); onCreada(); }
  };

  return (
    <Card>
      <SectionTitle>Crear nueva porra</SectionTitle>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {["partido", "especial"].map((t) => (
          <button key={t} onClick={() => setTipo(t)} style={styles.pill(tipo === t)}>{t === "partido" ? "PARTIDO" : "ESPECIAL"}</button>
        ))}
      </div>
      <Label>Jornada{tipo === "especial" ? " (opcional, se asigna al cerrar)" : ""}</Label>
      <input style={styles.inp} value={f.jornada} onChange={(e) => setF({ ...f, jornada: e.target.value })} placeholder={tipo === "especial" ? "Déjalo vacío si aún no toca" : ""} />
      {tipo === "especial" && <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Las porras especiales pueden quedarse sin número hasta que las cierres (útil para el campeón de liga, que se vota al inicio y se resuelve al final).</div>}
      <Label>Competición</Label>
      <SelectOEscribe value={f.comp} onChange={(val) => setF({ ...f, comp: val })} opciones={sug.comps} placeholder="Ej. La Liga Hypermotion" />
      <Label>Jornada del campeonato (opcional)</Label>
      <input style={styles.inp} value={f.jornada_camp || ""} onChange={(e) => setF({ ...f, jornada_camp: e.target.value })}
        placeholder="Ej. J12, Cuartos, Final" />
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
        Es la jornada de la competición real, distinta del número de porra. Sale en las imágenes.
      </div>
      {tipo === "especial" && (
        <>
          <Label>Título de la porra</Label>
          <input style={styles.inp} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ej. Top 3 final de Liga" />
          <Label>Imagen de cabecera (opcional, para la imagen de clasificación)</Label>
          <input type="file" accept="image/*" onChange={(e) => setCabeceraFile(e.target.files[0])} style={{ ...styles.inp, padding: 8 }} />
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Se usará de fondo del encabezado. Mejor apaisada y con zonas oscuras para que se lea el texto.</div>
        </>
      )}
      {tipo === "partido" ? (
        <>
          <Label>Sede</Label>
          <SelectOEscribe value={f.sede} onChange={(val) => setF({ ...f, sede: val })} opciones={sug.sedes} placeholder="Ej. Nuevo Estadio José Zorrilla" />
          <Label>Local</Label>
          <select style={styles.inp} value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })}>
            <option value="">— elige equipo —</option>
            {equipos.map((e) => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
          </select>
          <Label>Visitante</Label>
          <select style={styles.inp} value={f.visitante} onChange={(e) => setF({ ...f, visitante: e.target.value })}>
            <option value="">— elige equipo —</option>
            {equipos.map((e) => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
          </select>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>¿No está el equipo? Añádelo arriba en "Equipos y escudos".</div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, fontSize: 13 }}>
            <input type="checkbox" checked={f.eliminatoria} onChange={(e) => setF({ ...f, eliminatoria: e.target.checked })} /> ¿Eliminatoria? (se vota quién pasa/gana)
          </label>
          {f.eliminatoria && (
            <div style={{ marginTop: 8, padding: 10, background: "rgba(15,10,32,0.4)", borderRadius: 10 }}>
              <Label>¿Cómo se resuelve el "quién pasa/gana"?</Label>
              <select style={styles.inp} value={elimModo} onChange={(e) => setElimModo(e.target.value)}>
                <option value="aqui">Partido único: se vota y se resuelve en esta porra (final, semifinal a 1 partido…)</option>
                <option value="ida">Ida: se vota aquí, el punto se entrega al calcular la vuelta</option>
                <option value="vuelta">Vuelta: entrega el punto votado en una ida anterior</option>
              </select>
              {elimModo === "vuelta" && (
                <div style={{ marginTop: 8 }}>
                  <Label>Porra de ida correspondiente</Label>
                  {idasDisponibles.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.gold }}>No hay porras de ida en esta temporada.</div>
                  ) : (
                    <select style={styles.inp} value={idaId} onChange={(e) => setIdaId(e.target.value)}>
                      <option value="">— elige la ida —</option>
                      {idasDisponibles.map((p) => (
                        <option key={p.id} value={p.id}>#{p.jornada} · {p.local} - {p.visitante}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <Label>Modo de puntuación</Label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <button onClick={() => setModo("exacto")} style={styles.pill(modo === "exacto")}>PREDICCIÓN</button>
            <button onClick={() => setModo("aproximacion")} style={styles.pill(modo === "aproximacion")}>GORDO (terminación)</button>
          </div>
          {modo === "exacto" ? (
            <>
              <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 8 }}>La porra tiene una sola predicción. Su enunciado es el título de arriba. Configura el tipo y los puntos a mano.</div>
              {preds.slice(0, 1).map((p, i) => (
                <div key={i} style={{ marginBottom: 12, padding: 12, background: "rgba(15,10,32,0.4)", borderRadius: 10, border: `1px solid ${C.line}` }}>
                  <Label>Tipo de predicción</Label>
                  <select style={{ ...styles.inp, marginBottom: 8 }} value={p.tipo} onChange={(e) => { const c = [...preds]; c[i] = { ...c[i], tipo: e.target.value }; setPreds(c); }}>
                    <option value="opcion">Opción de una lista (elige 1)</option>
                    <option value="equipo_puesto">Equipo por puesto (top con aproximación)</option>
                    <option value="numero">Número (con margen de aproximación)</option>
                  </select>
                  {p.tipo === "opcion" && (
                    <input style={{ ...styles.inp, fontSize: 13 }} placeholder="Opciones separadas por comas (ej. Madrid, Barça, Atlético)" value={p.opciones} onChange={(e) => { const c = [...preds]; c[i] = { ...c[i], opciones: e.target.value }; setPreds(c); }} />
                  )}
                  {p.tipo === "equipo_puesto" && (
                    <>
                      <input style={{ ...styles.inp, fontSize: 13, marginBottom: 6 }} placeholder="Equipos elegibles, separados por comas" value={p.opciones} onChange={(e) => { const c = [...preds]; c[i] = { ...c[i], opciones: e.target.value }; setPreds(c); }} />
                      <input style={{ ...styles.inp, fontSize: 13 }} placeholder="Puestos, separados por comas (ej. 1º, 2º, 3º)" value={p.puestos} onChange={(e) => { const c = [...preds]; c[i] = { ...c[i], puestos: e.target.value }; setPreds(c); }} />
                      <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>El votante asignará un equipo a cada puesto. Exacto = en su puesto; aprox = está en el top pero en otro puesto.</div>
                    </>
                  )}
                  {p.tipo === "numero" && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, opacity: 0.7 }}>Margen de aproximación: ±</span>
                      <input style={{ ...styles.inp, width: 70, fontSize: 13 }} type="number" value={p.margen} onChange={(e) => { const c = [...preds]; c[i] = { ...c[i], margen: e.target.value }; setPreds(c); }} />
                    </div>
                  )}
                  <div style={{ marginTop: 10 }}>
                    <Label>Cómo llamar a la aproximación en la imagen</Label>
          <input style={styles.inp} value={g.etiqueta_aprox} onChange={(e) => setG({ ...g, etiqueta_aprox: e.target.value })}
            placeholder="Ej. Subcampeón, Finalista, 4º clasificado" />
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
            Si lo dejas vacío aparecerá «APROX».
          </div>
          <Label>Puntos de esta predicción</Label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {[["p_exacto", "Puesto exacto"], ["p_unico", "Exacto único"],
              ["p_aprox", "Equipo en otro puesto"], ["p_unico_aprox", "Otro puesto único"],
              ["p_aprox_ext", "Equipo de aproximación"], ["p_unico_aprox_ext", "Aproximación única"]].map(([k, lbl]) => (
                        <div key={k}>
                          <span style={{ fontSize: 11, opacity: 0.7 }}>{lbl}</span>
                          <input style={{ ...styles.inp, fontSize: 13 }} type="number" value={p[k]} placeholder="—"
                            onChange={(e) => { const c = [...preds]; c[i] = { ...c[i], [k]: e.target.value }; setPreds(c); }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.6, marginTop: 6 }}>Para "aproximación sin únicos": pon el mismo valor en Aproximación y Aprox. único (ej. 1 y 1).</div>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8, padding: 10, background: "rgba(15,10,32,0.4)", borderRadius: 8 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}><Label>Pts acierto</Label><input style={styles.inp} type="number" value={f.puntos_acierto} onChange={(e) => setF({ ...f, puntos_acierto: e.target.value })} /></div>
                <div style={{ flex: 1 }}><Label>Pts único</Label><input style={styles.inp} type="number" value={f.puntos_unico} onChange={(e) => setF({ ...f, puntos_unico: e.target.value })} /></div>
                <div style={{ flex: 1 }}><Label>Pts aprox.</Label><input style={styles.inp} type="number" value={f.puntos_aprox} onChange={(e) => setF({ ...f, puntos_aprox: e.target.value })} /></div>
              </div>
              Modo gordo: cada participante vota una <b>terminación (0–9)</b>. Acierto exacto = pts acierto/único; quedarse a 1 (vecinos, 0 y 9 incluidos) = pts aprox.
              Crea una porra para el 1er premio y otra para el 2º.
            </div>
          )}
        </>
      )}
      <Label>{tipo === "partido" ? "Hora de inicio del partido (cierra la votación)" : "Fecha límite para votar"} — hora de España</Label>
      <input type="datetime-local" style={styles.inp} value={cierre} onChange={(e) => setCierre(e.target.value)} />
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Si lo dejas vacío, la votación no se cierra sola (la cierras tú al meter el resultado).</div>
      <button style={{ ...styles.btnPrimary, marginTop: 16 }} onClick={crear}>CREAR PORRA</button>
      <Msg m={localMsg} />
    </Card>
  );
}

function fmtVotoAdmin(porra, c, esAprox) {
  if (!c) return "";
  if (porra.tipo === "partido") return `${c.local}-${c.visitante}${c.pasa ? " · " + c.pasa : ""}`;
  if (esAprox) return `termina en ${c.digito}`;
  const preds = (porra.predicciones || []).map((p) => typeof p === "string" ? { texto: p, tipo: "opcion" } : p);
  return (c.resp || []).map((r, i) => {
    const p = preds[i] || { tipo: "opcion" };
    if (p.tipo === "equipo_puesto" && Array.isArray(r)) return (p.puestos || []).map((pu, s) => `${pu} ${r[s] || "—"}`).join(", ");
    return String(r);
  }).join(" · ");
}

function GestionPorra({ porra, temporada, onChange, equipos = [] }) {
  const esAprox = porra.tipo === "especial" && porra.modo === "aproximacion";
  const [votos, setVotos] = useState([]);
  const [real, setReal] = useState(
    porra.tipo === "partido" ? { local: 2, visitante: 2, pasa: porra.local }
    : esAprox ? "" // número del premio (texto, se toma el último dígito)
    : (porra.predicciones || []).map((p) => (typeof p === "object" && p.tipo === "equipo_puesto") ? [] : "")
  );
  const [filas, setFilas] = useState(null);
  const [msg, setMsg] = useState(null);
  const [promoUrl, setPromoUrl] = useState(null);
  const [resultadosUrl, setResultadosUrl] = useState(null);
  const [votosUrl, setVotosUrl] = useState(null);
  const [comentarios, setComentarios] = useState(porra.comentarios || "");
  const [subcomentario, setSubcomentario] = useState(porra.subcomentario || "");
  const [generando, setGenerando] = useState(false);
  const [participantes, setParticipantes] = useState([]);
  const [ida, setIda] = useState(null);
  const [pasaManual, setPasaManual] = useState([]); // jugadores que aciertan el pase (entrada manual)
  const [manual, setManual] = useState({}); // { jugador: contenido }
  const [jornadaCierre, setJornadaCierre] = useState(porra.jornada ? String(porra.jornada) : "");
  const [borrandoVoto, setBorrandoVoto] = useState(null);
  const sinJornada = porra.tipo === "especial" && (porra.jornada == null);
  const enlace = `${window.location.origin}/votar/${porra.id}`;

  useEffect(() => { getParticipantes(temporada.id).then(setParticipantes); }, [temporada.id]);
  useEffect(() => {
    // Si la especial no tiene jornada aún, proponer la última+1
    if (sinJornada && !jornadaCierre) getSugerenciasPorra(temporada.id).then((s) => setJornadaCierre(String(s.siguienteJornada)));
  }, [sinJornada]); // eslint-disable-line
  useEffect(() => {
    if (porra.ida_id) supabase.from("porras").select("*").eq("id", porra.ida_id).single().then(({ data }) => setIda(data));
  }, [porra.ida_id]);

  const generarImagen = async () => {
    setGenerando(true);
    const [eqL, eqV] = await Promise.all([getEquipo(porra.local), getEquipo(porra.visitante)]);
    const url = await generarPromo(porra, eqL, eqV);
    setPromoUrl(url);
    setGenerando(false);
  };

  const cargarVotos = async () => {
    const { data } = await supabase.from("votos").select("*").eq("porra_id", porra.id);
    setVotos(data || []);
  };
  useEffect(() => { cargarVotos(); }, [porra.id]);

  const votoActual = (jugador) => votos.find((v) => v.jugador === jugador)?.contenido;

  const guardarVotoManual = async (jugador, contenido) => {
    const { error } = await supabase.from("votos").upsert(
      { porra_id: porra.id, jugador, contenido }, { onConflict: "porra_id,jugador" }
    );
    if (error) { setMsg(["err", error.message]); return; }
    await cargarVotos();
    setMsg(["ok", `Voto de ${jugador} guardado.`]);
  };

  const borrarVoto = async (v) => {
    const { error } = await supabase.from("votos").delete().eq("id", v.id);
    setBorrandoVoto(null);
    if (error) setMsg(["err", "No se pudo borrar: " + error.message]);
    else { setMsg(["ok", `Voto de ${v.jugador} borrado.`]); cargarVotos(); }
  };

  const calcular = async () => {
    if (votos.length === 0) { setMsg(["err", "No hay votos."]); return; }
    if (esAprox && (real === "" || isNaN(parseInt(real, 10)))) { setMsg(["err", "Introduce el número del premio."]); return; }
    if (sinJornada && (!jornadaCierre || isNaN(+jornadaCierre))) { setMsg(["err", "Asigna el número de jornada antes de cerrar esta porra especial."]); return; }

    // El partido en sí NO entrega el punto de "pasa" (eso es de la eliminatoria).
    const realPartido = porra.tipo === "partido" ? { ...real, pasa: null } : real;
    const rows = porra.tipo === "partido" ? computePartido(votos, realPartido)
      : esAprox ? computeAproximacion(porra, votos, real)
      : computeEspecial(porra, votos, real);

    // Si esta porra es la VUELTA de una eliminatoria, entregar el punto extra
    // a quien acertó "quién pasa" en la IDA. El admin indica el equipo en real.pasa.
    let avisoExtra = "";
    const darExtra = (jugadores) => {
      const set = new Set(jugadores);
      let n = 0;
      rows.forEach((r) => { if (set.has(r.jugador)) { r.extra = (r.extra || 0) + 1; r.total += 1; n++; } });
      set.forEach((jug) => { if (!rows.find((r) => r.jugador === jug)) { rows.push({ jugador: jug, base: 0, tipo: "d", extra: 1, total: 1, sdp: 0 }); n++; } });
      return n;
    };
    if (porra.tipo === "partido" && porra.pase_aqui && real.pasa) {
      // Partido único: el pase se votó en esta misma porra.
      const aciertan = votos.filter((v) => v.contenido?.pasa === real.pasa).map((v) => v.jugador);
      const n = darExtra(aciertan);
      avisoExtra = ` Punto de eliminatoria entregado a ${n} jugador(es) que acertaron quién pasaba/ganaba.`;
    } else if (porra.tipo === "partido" && porra.ida_id && real.pasa) {
      const { data: votosIda } = await supabase.from("votos").select("jugador, contenido").eq("porra_id", porra.ida_id);
      const aciertan = (votosIda || []).filter((v) => v.contenido?.pasa === real.pasa).map((v) => v.jugador);
      const n = darExtra(aciertan);
      avisoExtra = ` Punto de eliminatoria entregado a ${n} jugador(es) que acertaron quién pasaba.`;
    } else if (porra.tipo === "partido" && !porra.ida_id && !porra.pase_aqui && pasaManual.length > 0) {
      const n = darExtra(pasaManual);
      avisoExtra = ` Punto de eliminatoria (manual) entregado a ${n} jugador(es).`;
    }

    const updPorra = { cerrada: true, resultado: esAprox ? { premio: real } : real, resultado_final: (porra.tipo === "partido" ? (real.resultado_final || null) : null) };
    if (sinJornada) updPorra.jornada = +jornadaCierre;
    await supabase.from("porras").update(updPorra).eq("id", porra.id);

    for (const r of rows) {
      await supabase.from("resultados_porra").upsert({
        porra_id: porra.id, temporada_id: temporada.id, jugador: r.jugador,
        tipo: r.tipo, extra: r.extra || 0, pt: r.total, sdp: r.sdp,
      }, { onConflict: "porra_id,jugador" });
    }

    const orden = await recomponerClasificacion(temporada.id);
    const palmares = await getPalmares();
    const mov = await getMovimientos(temporada.id);
    const ptJ = Object.fromEntries(rows.map((r) => [r.jugador, r.total]));
    const sdpJ = Object.fromEntries(rows.map((r) => [r.jugador, r.sdp]));
    setFilas(orden.map((r) => ({ ...r, ptJornada: ptJ[r.jugador] || 0, sdpJornada: sdpJ[r.jugador] || 0, titulos: palmares[r.jugador] || 0, mov: mov[r.jugador] ?? 0 })));
    setMsg(["ok", "Jornada calculada." + avisoExtra]);
    onChange();
  };

  return (
    <Card>
      <SectionTitle>Gestionar #{porra.jornada} — {porra.comp}</SectionTitle>
      {porra.cierra_en && (
        <div style={{ fontSize: 12, marginBottom: 10, color: estaCerrada(porra) ? C.red : C.gold }}>
          {estaCerrada(porra) ? "Votación cerrada · " : "Cierra el "}{formatoMadrid(porra.cierra_en)}{!estaCerrada(porra) && " (hora española)"}
        </div>
      )}
      <div style={{ padding: 12, background: "rgba(15,10,32,0.5)", borderRadius: 12, fontSize: 12, marginBottom: 12 }}>
        <div style={{ marginBottom: 8, opacity: 0.8 }}>Enlace de votación:</div>
        <a href={enlace} style={{ wordBreak: "break-all" }}>{enlace}</a>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button style={styles.btnGhost} onClick={() => {
            const texto = `🔮 Porra ${porra.jornada} — ${porra.comp}\n${porra.tipo === "partido" ? `${porra.local} vs ${porra.visitante}\n` : ""}¡Vota aquí! 👉 ${enlace}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
          }}>📲 Compartir por WhatsApp</button>
          <button style={{ ...styles.btnGhost, opacity: 0.7 }} onClick={() => navigator.clipboard.writeText(enlace)}>Copiar</button>
        </div>
      </div>

      {!porra.cerrada && (
        <EditarPorra porra={porra} nVotos={votos.length} equipos={equipos} onGuardado={onChange} setMsg={setMsg} />
      )}

      {porra.tipo === "partido" && (
        <div style={{ marginBottom: 12 }}>
          <button style={styles.btnGhost} onClick={generarImagen} disabled={generando}>
            {generando ? "Generando…" : "🖼 Generar imagen promocional"}
          </button>
          {promoUrl && (
            <div style={{ marginTop: 10 }}>
              <img src={promoUrl} alt="promo" style={{ width: "100%", maxWidth: 360, borderRadius: 8, border: `1px solid ${C.line}` }} />
              <CompartirImagen dataUrl={promoUrl} nombre={`porra_${porra.jornada || "especial"}.png`}
                texto={`¡Vota la porra ${porra.jornada || ""}! ${window.location.origin}/votar/${porra.id}`}
                guardable={{ tipo: "promo", titulo: `Presentación · porra ${porra.jornada || ""}`, temporadaId: temporada.id, porraId: porra.id }} />
              <div>
                <button style={{ ...styles.btnGhost, marginTop: 8 }} onClick={() => descargarDataUrl(promoUrl, `porra_${porra.jornada}.png`)}>⬇ Descargar imagen</button>
              </div>
            </div>
          )}
        </div>
      )}

      {porra.tipo === "especial" && (
        <div style={{ marginBottom: 12 }}>
          <button style={styles.btnGhost} onClick={async () => {
            setGenerando(true);
            const url = await generarPromoEspecial({ ...porra, resultado: porra.resultado });
            setPromoUrl(url); setGenerando(false);
          }} disabled={generando}>
            {generando ? "Generando…" : "🖼 Generar imagen de presentación"}
          </button>
          {promoUrl && (
            <div style={{ marginTop: 10 }}>
              <img src={promoUrl} alt="promo-especial" style={{ width: "100%", maxWidth: 360, borderRadius: 8, border: `1px solid ${C.line}` }} />
              <CompartirImagen dataUrl={promoUrl} nombre={`porra_${porra.jornada || "especial"}.png`}
                texto={`¡Vota la porra especial! ${window.location.origin}/votar/${porra.id}`}
                guardable={{ tipo: "especial", titulo: `Presentación · ${porra.sede || "especial"}`, temporadaId: temporada.id, porraId: porra.id }} />
              <div>
                <button style={{ ...styles.btnGhost, marginTop: 8 }} onClick={() => descargarDataUrl(promoUrl, `porra_${porra.jornada}.png`)}>⬇ Descargar imagen</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Imagen de resultados (clasificación) — disponible siempre, recupera la clasificación actual */}
      <div style={{ marginBottom: 12 }}>
        <button style={styles.btnGhost} onClick={async () => {
          const orden = await recomponerClasificacion(temporada.id);
          const rp = await getResultadoPorra(porra.id);
          const palmares = await getPalmares();
          const mov = await getMovimientos(temporada.id);
          const url = await generarImagenResultados({ ...porra, resultado: porra.resultado }, orden.map((r) => ({ ...r, ptJornada: rp[r.jugador]?.pt || 0, sdpJornada: rp[r.jugador]?.sdp || 0, titulos: palmares[r.jugador] || 0, mov: mov[r.jugador] ?? 0 })));
          setResultadosUrl(url);
        }}>🏟 Generar imagen de clasificación</button>
        {resultadosUrl && (
          <div style={{ marginTop: 10 }}>
            <img src={resultadosUrl} alt="clasificación" style={{ width: "100%", maxWidth: 360, borderRadius: 12, border: `1px solid ${C.line}` }} />
            <CompartirImagen dataUrl={resultadosUrl} nombre={`clasificacion_porra_${porra.jornada || "especial"}.png`}
              texto={`Clasificación tras la porra ${porra.jornada || ""} · ${porra.comp || ""}`.trim()}
              guardable={{ tipo: "clasificacion", titulo: `Clasificación · porra ${porra.jornada || porra.sede || ""}`, temporadaId: temporada.id, porraId: porra.id }} />
          </div>
        )}
      </div>

      <Label>Votos recibidos ({votos.length})</Label>
      {participantes.length > 0 && (() => {
        const hanVotado = new Set(votos.map((v) => v.jugador));
        const faltan = participantes.filter((p) => !hanVotado.has(p.nombre));
        return faltan.length === 0
          ? <div style={{ fontSize: 12, color: C.green, marginBottom: 8 }}>✓ Han votado todos los participantes.</div>
          : <div style={{ fontSize: 12, color: C.gold, marginBottom: 8 }}>Faltan por votar ({faltan.length}): {faltan.map((p) => p.nombre).join(", ")}</div>;
      })()}
      {!porra.cerrada && (
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, padding: 8, background: "rgba(183,148,255,0.07)", borderRadius: 8 }}>
          🔒 Mientras la porra está abierta solo se ve quién ha votado, no su pronóstico. El detalle se desbloquea al cerrarla.
        </div>
      )}
      {votos.map((v) => (
        <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 13, borderBottom: `1px solid ${C.line}` }}>
          <span>{v.jugador}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {porra.cerrada
              ? <span style={{ color: C.accent, textAlign: "right" }}>{fmtVotoAdmin(porra, v.contenido, esAprox)}</span>
              : <span style={{ color: C.green, fontSize: 12 }}>✓ votó</span>}
            {!porra.cerrada && (
              borrandoVoto === v.id ? (
                <>
                  <button style={{ ...styles.btnGhost, padding: "2px 8px", fontSize: 11, color: C.red }}
                    onClick={() => borrarVoto(v)}>Sí, borrar</button>
                  <button style={{ ...styles.btnGhost, padding: "2px 8px", fontSize: 11 }}
                    onClick={() => setBorrandoVoto(null)}>No</button>
                </>
              ) : (
                <button title="Borrar este voto" style={{ background: "transparent", border: "none", color: C.red, cursor: "pointer", fontSize: 15, padding: "0 4px" }}
                  onClick={() => setBorrandoVoto(v.id)}>🗑</button>
              )
            )}
          </span>
        </div>
      ))}
      {!porra.cerrada && votos.length > 0 && (
        <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
          Puedes borrar un voto mientras la porra siga abierta. Una vez cerrada quedan bloqueados.
        </div>
      )}
      {votos.length > 0 && porra.cerrada && (
        <div style={{ marginTop: 12 }}>
          <button style={styles.btnGhost} onClick={async () => {
            const aciertos = porra.cerrada ? await getResultadoPorra(porra.id) : null;
            setVotosUrl(await generarImagenVotos(porra, votos, aciertos && Object.keys(aciertos).length ? aciertos : null));
          }}>🗳 Generar imagen de votos (para WhatsApp)</button>
          {votosUrl && (
            <div style={{ marginTop: 10 }}>
              <img src={votosUrl} alt="votos" style={{ width: "100%", maxWidth: 360, borderRadius: 12, border: `1px solid ${C.line}` }} />
              <CompartirImagen dataUrl={votosUrl} nombre={`votos_porra_${porra.jornada || "especial"}.png`}
                texto={`Votos de la porra ${porra.jornada || ""}`.trim()}
                guardable={{ tipo: "votos", titulo: `Votos · porra ${porra.jornada || porra.sede || ""}`, temporadaId: temporada.id, porraId: porra.id }} />
              <div><button style={{ ...styles.btnGhost, marginTop: 8 }} onClick={() => descargarDataUrl(votosUrl, `votos_porra_${porra.jornada}.png`)}>⬇ Descargar imagen</button></div>
            </div>
          )}
        </div>
      )}

      {!porra.cerrada && (
        <div style={{ marginTop: 18, padding: 14, background: "rgba(15,10,32,0.4)", borderRadius: 12, border: `1px solid ${C.line}` }}>
          <Label>Cargar votos a mano</Label>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
            Mete tú el pronóstico de quien no pueda votar por su cuenta. Los que ya votaron aparecen
            bloqueados 🔒: su pronóstico no se ve hasta cerrar la porra. Si necesitas corregir uno,
            bórralo antes en la lista de votos de arriba.
          </div>
          {participantes.map((p) => (
            <VotoManual key={p.id} porra={porra} esAprox={esAprox} jugador={p.nombre}
              actual={votoActual(p.nombre)} onGuardar={guardarVotoManual} />
          ))}
        </div>
      )}

      {!porra.cerrada && (
        <div style={{ marginTop: 16 }}>
          <Label>Resultado real</Label>
          {porra.tipo === "partido" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", margin: "8px 0" }}>
                <Stepper label={porra.local} value={real.local} set={(x) => setReal({ ...real, local: x })} />
                <span style={{ fontSize: 24, opacity: 0.5 }}>—</span>
                <Stepper label={porra.visitante} value={real.visitante} set={(x) => setReal({ ...real, visitante: x })} />
              </div>
              {/* IDA: el punto se da en la vuelta, aquí solo nota */}
              {porra.eliminatoria && !porra.pase_aqui && !porra.ida_id && (
                <div style={{ fontSize: 11, color: C.muted, marginTop: 8, fontStyle: "italic" }}>
                  Ida de eliminatoria: los jugadores ya votaron quién pasa. El punto se entrega al calcular la vuelta.
                </div>
              )}
              {/* PARTIDO ÚNICO: se vota y resuelve aquí */}
              {porra.pase_aqui && (
                <div style={{ marginTop: 10, padding: 10, background: "rgba(252,211,77,0.08)", border: `1px solid rgba(252,211,77,0.3)`, borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: C.gold, marginBottom: 8 }}>¿Quién pasa/gana? (entrega el punto a quien lo acertó en esta porra)</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[porra.local, porra.visitante].map((t) => (
                      <button key={t} onClick={() => setReal({ ...real, pasa: t })} style={styles.pill(real.pasa === t)}>Pasa {t}</button>
                    ))}
                  </div>
                </div>
              )}
              {/* VUELTA: usa los votos de la ida */}
              {porra.ida_id && (
                <div style={{ marginTop: 10, padding: 10, background: "rgba(252,211,77,0.08)", border: `1px solid rgba(252,211,77,0.3)`, borderRadius: 10 }}>
                  <div style={{ fontSize: 12, color: C.gold, marginBottom: 8 }}>¿Quién pasó la eliminatoria? (entrega el punto a quien lo acertó en la ida)</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[...new Set([ida?.local, ida?.visitante, porra.local, porra.visitante].filter(Boolean))].map((t) => (
                      <button key={t} onClick={() => setReal({ ...real, pasa: t })} style={styles.pill(real.pasa === t)}>Pasa {t}</button>
                    ))}
                  </div>
                </div>
              )}
              {/* Resultado final estético (prórroga/penaltis) */}
              <div style={{ marginTop: 10 }}>
                <Label>Resultado final si hubo prórroga/penaltis (opcional, solo para la imagen)</Label>
                <input style={styles.inp} value={real.resultado_final || ""} onChange={(e) => setReal({ ...real, resultado_final: e.target.value })} placeholder="Ej. 2-2 (4-3 pen.) · 90 min: 2-2" />
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Solo se puntúan los 90 minutos; esto es para que la foto muestre el desenlace.</div>
              </div>
              {/* Entrada manual del pase: para vueltas viejas sin ida ni pase aquí */}
              {!porra.ida_id && !porra.pase_aqui && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, color: C.muted }}>¿Eliminatoria antigua sin votos en la app? Marca quién acertó el pase →</summary>
                  <div style={{ marginTop: 8, padding: 10, background: "rgba(252,211,77,0.08)", border: `1px solid rgba(252,211,77,0.3)`, borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: C.gold, marginBottom: 8 }}>Marca los que acertaron quién pasaba (según tu hoja). Recibirán +1 en la columna E.</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {participantes.map((p) => {
                        const on = pasaManual.includes(p.nombre);
                        return (
                          <button key={p.id} onClick={() => setPasaManual(on ? pasaManual.filter((j) => j !== p.nombre) : [...pasaManual, p.nombre])}
                            style={{ ...styles.pill(on), fontSize: 12, padding: "6px 10px" }}>{on ? "✓ " : ""}{p.nombre}</button>
                        );
                      })}
                    </div>
                  </div>
                </details>
              )}
            </>
          ) : esAprox ? (
            <>
              <input style={styles.inp} value={real} onChange={(e) => setReal(e.target.value.replace(/\D/g, ""))} placeholder="Número del premio (ej. 26416)" />
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>Se usa el último dígito. Acierto = ese dígito; aproximan los vecinos (±1, circular).</div>
            </>
          ) : (
            (porra.predicciones || []).map((pred, i) => {
              const p = typeof pred === "string" ? { texto: pred, tipo: "opcion", opciones: [] } : pred;
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <Label>{p.texto}</Label>
                  {p.tipo === "opcion" && (() => {
                    // real[i] puede ser texto (solo exacto) u objeto { exacto, aprox }
                    const val = real[i];
                    const esObj = val != null && typeof val === "object";
                    const vExacto = esObj ? (val.exacto || "") : (val || "");
                    const vAprox = esObj ? (val.aprox || "") : "";
                    // Puntos de aproximación configurados en esta predicción (informativo)
                    const ptsAprox = Number(p.puntos_aprox ?? porra.puntos_aprox ?? 0) || 0;
                    // El campo de aproximación se ofrece SIEMPRE: si lo rellenas, puntúa.
                    const set = (exacto, aprox) => {
                      const c = [...real];
                      c[i] = (aprox && aprox !== "") ? { exacto, aprox } : exacto;
                      setReal(c);
                    };
                    const Campo = ({ valor, onCambio, etiqueta, ph }) => (
                      <>
                        {etiqueta && <div style={{ fontSize: 11, color: C.muted, margin: "6px 0 3px" }}>{etiqueta}</div>}
                        {(p.opciones && p.opciones.length > 0) ? (
                          <select style={styles.inp} value={valor} onChange={(e) => onCambio(e.target.value)}>
                            <option value="">— {ph} —</option>
                            {p.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input style={styles.inp} value={valor} onChange={(e) => onCambio(e.target.value)} placeholder={ph} />
                        )}
                      </>
                    );
                    return (
                      <>
                        <Campo valor={vExacto} onCambio={(x) => set(x, vAprox)}
                          etiqueta="Acierto pleno" ph="resultado" />
                        <Campo valor={vAprox} onCambio={(x) => set(vExacto, x)}
                          etiqueta="Acierto por aproximación — opcional (p. ej. subcampeón)" ph="p. ej. subcampeón" />
                        {ptsAprox > 0 ? (
                          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 3 }}>
                            Quien votara esta segunda opción recibe {ptsAprox} pts. Déjalo vacío si no aplica.
                          </div>
                        ) : (
                          <div style={{ fontSize: 11, color: C.gold, marginTop: 3 }}>
                            ⚠️ Esta predicción tiene 0 puntos de aproximación, así que rellenar el segundo campo no daría puntos.
                            Ajústalos en «✏️ Editar porra» antes de calcular.
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {p.tipo === "numero" && (
                    <input type="number" style={styles.inp} value={real[i] ?? ""} onChange={(e) => { const c = [...real]; c[i] = e.target.value; setReal(c); }} placeholder="Número real" />
                  )}
                  {p.tipo === "equipo_puesto" && (() => {
                    // real[i] puede ser array (formato antiguo) o { lista:[...], aprox:"Equipo" }
                    const v = real[i];
                    const esObj = v != null && !Array.isArray(v) && typeof v === "object";
                    const lista = esObj ? (v.lista || []) : (Array.isArray(v) ? v : []);
                    const aprox = esObj ? (v.aprox || "") : "";
                    const set = (nuevaLista, nuevoAprox) => {
                      const c = [...real];
                      c[i] = (nuevoAprox && nuevoAprox !== "") ? { lista: nuevaLista, aprox: nuevoAprox } : nuevaLista;
                      setReal(c);
                    };
                    const ptsExt = p.puntos_aprox_ext ?? 1;
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {(p.puestos || []).map((puesto, s) => (
                          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ minWidth: 50, fontSize: 13, color: C.accent, fontWeight: 600 }}>{puesto}</span>
                            <select style={{ ...styles.inp, flex: 1 }} value={lista[s] || ""} onChange={(e) => {
                              const arr = [...lista]; arr[s] = e.target.value; set(arr, aprox);
                            }}>
                              <option value="">— equipo —</option>
                              {(p.opciones || []).map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                        ))}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6,
                          paddingTop: 8, borderTop: `1px solid ${C.line}` }}>
                          <span style={{ minWidth: 50, fontSize: 12, color: C.gold, fontWeight: 600 }}>Aprox.</span>
                          <select style={{ ...styles.inp, flex: 1 }} value={aprox} onChange={(e) => set(lista, e.target.value)}>
                            <option value="">— ninguno —</option>
                            {(p.opciones || []).filter((o) => !lista.includes(o)).map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.65 }}>
                          Equipo que se quedó fuera pero cerca. Quien lo votara recibe {ptsExt} pts. Opcional.
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })
          )}
          {sinJornada && (
            <div style={{ marginTop: 14, padding: 12, background: "rgba(183,148,255,0.1)", border: `1px solid ${C.panelBorder}`, borderRadius: 10 }}>
              <Label>Número de jornada para esta porra (se asigna al cerrar)</Label>
              <input style={{ ...styles.inp, maxWidth: 140 }} type="number" value={jornadaCierre} onChange={(e) => setJornadaCierre(e.target.value)} />
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Propuesta: la jornada en curso. Así la porra queda ordenada con el resto, no con un número antiguo.</div>
            </div>
          )}
          <button style={{ ...styles.btnPrimary, marginTop: 14 }} onClick={calcular}>CALCULAR Y ACTUALIZAR CLASIFICACIÓN</button>
        </div>
      )}
      <Msg m={msg} />

      {filas && (
        <div style={{ marginTop: 20 }}>
          <Label>Titular de la jornada (corto, sale destacado)</Label>
          <textarea
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Ej: Kike hace una manita."
            style={{ ...styles.inp, minHeight: 60, resize: "vertical", marginBottom: 8 }}
          />
          <Label>Subcomentario de la jornada (más largo, debajo del titular)</Label>
          <textarea
            value={subcomentario}
            onChange={(e) => setSubcomentario(e.target.value)}
            placeholder="Ej: Bea recupera el liderato gracias al SDP, mientras Parro se hunde tras fallar el pleno..."
            style={{ ...styles.inp, minHeight: 80, resize: "vertical", marginBottom: 8 }}
          />
          <button style={{ ...styles.btnGhost, marginBottom: 16 }} onClick={async () => {
            await supabase.from("porras").update({ comentarios, subcomentario }).eq("id", porra.id);
            setMsg(["ok", "Comentarios guardados."]);
          }}>Guardar comentarios</button>
          {(comentarios || subcomentario) && (
            <div style={{ padding: 14, background: "rgba(252,211,77,0.08)", border: `1px solid rgba(252,211,77,0.25)`, borderRadius: 12, marginBottom: 16 }}>
              {comentarios && <div style={{ fontSize: 14, fontWeight: 700, color: C.gold, whiteSpace: "pre-wrap" }}>{comentarios}</div>}
              {subcomentario && <div style={{ fontSize: 12, color: C.gold, opacity: 0.85, whiteSpace: "pre-wrap", marginTop: 6 }}>{subcomentario}</div>}
            </div>
          )}
          <TablaClasificacion filas={filas} />
          <div style={{ marginTop: 16, padding: 12, background: "rgba(15,10,32,0.4)", border: `1px solid ${C.line}`, borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📊 Rachas y datos para el comentario</div>
            <DestacadosRachas temporadaId={temporada.id} porraRecienteId={porra.id} compacto />
          </div>
          <div style={{ marginTop: 14 }}>
            <button style={styles.btnGhost} onClick={async () => {
              const url = await generarImagenResultados({ ...porra, resultado: real, comentarios, subcomentario }, filas);
              setResultadosUrl(url);
            }}>🏟 Generar imagen de resultados (para WhatsApp)</button>
            {resultadosUrl && (
              <div style={{ marginTop: 10 }}>
                <img src={resultadosUrl} alt="resultados" style={{ width: "100%", maxWidth: 360, borderRadius: 12, border: `1px solid ${C.line}` }} />
                <CompartirImagen dataUrl={resultadosUrl} nombre={`clasificacion_porra_${porra.jornada || "especial"}.png`}
                  texto={`Clasificación tras la porra ${porra.jornada || ""} · ${porra.comp || ""}`.trim()}
                  guardable={{ tipo: "clasificacion", titulo: `Clasificación · porra ${porra.jornada || porra.sede || ""}`, temporadaId: temporada.id, porraId: porra.id }} />
                <div><button style={{ ...styles.btnGhost, marginTop: 8 }} onClick={() => descargarDataUrl(resultadosUrl, `resultados_porra_${porra.jornada}.png`)}>⬇ Descargar imagen</button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function VotoManual({ porra, esAprox, jugador, actual, onGuardar }) {
  const [abierto, setAbierto] = useState(false);
  const [l, setL] = useState(actual?.local ?? 1);
  const [v, setV] = useState(actual?.visitante ?? 1);
  const [pasa, setPasa] = useState(actual?.pasa ?? porra.local);
  const [dig, setDig] = useState(actual?.digito ?? 0);
  const [resp, setResp] = useState(actual?.resp ?? (porra.predicciones || []).map((p) => (typeof p === "object" && p.tipo === "equipo_puesto") ? [] : ""));

  const guardar = () => {
    let contenido;
    // El pase solo se vota aquí si es eliminatoria y NO es la vuelta de otra porra
    const pidePase = porra.eliminatoria && !porra.ida_id;
    if (porra.tipo === "partido") contenido = { local: +l, visitante: +v, pasa: pidePase ? pasa : null };
    else if (esAprox) contenido = { digito: Number(dig) };
    else contenido = { resp: [...resp] };
    onGuardar(jugador, contenido);
    setAbierto(false);
  };

  // Mientras la porra está abierta no se revela el pronóstico de nadie:
  // ni en el resumen ni abriendo el formulario (que vendría relleno).
  const oculto = !!actual && !porra.cerrada;
  const resumen = !actual ? "sin voto" : (porra.cerrada ? fmtVotoAdmin(porra, actual, esAprox) : "✓ votó");

  return (
    <div style={{ borderBottom: `1px solid ${C.line}`, padding: "8px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14 }}>{jugador}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: actual ? C.green : C.muted, fontFamily: mono }}>{resumen}</span>
          {oculto
            ? <span style={{ fontSize: 11, color: C.muted }}>🔒</span>
            : <button style={styles.btnGhost} onClick={() => setAbierto(!abierto)}>{abierto ? "Cerrar" : "Editar"}</button>}
        </div>
      </div>
      {abierto && !oculto && (
        <div style={{ marginTop: 10 }}>
          {porra.tipo === "partido" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
                <Stepper label={porra.local} value={l} set={setL} />
                <span style={{ fontSize: 20, opacity: 0.5 }}>—</span>
                <Stepper label={porra.visitante} value={v} set={setV} />
              </div>
              {porra.eliminatoria && !porra.ida_id && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {[porra.local, porra.visitante].map((t) => (
                    <button key={t} onClick={() => setPasa(t)} style={styles.pill(pasa === t)}>Pasa {t}</button>
                  ))}
                </div>
              )}
            </>
          ) : esAprox ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {[0,1,2,3,4,5,6,7,8,9].map((d) => (
                <button key={d} onClick={() => setDig(d)} style={{ ...styles.pill(Number(dig) === d), flex: "0 0 auto", width: 42 }}>{d}</button>
              ))}
            </div>
          ) : (
            (porra.predicciones || []).map((pred, i) => {
              const p = typeof pred === "string" ? { texto: pred, tipo: "opcion", opciones: [] } : pred;
              return (
                <div key={i} style={{ marginBottom: 8 }}>
                  <Label>{p.texto}</Label>
                  {p.tipo === "opcion" && (
                    (p.opciones && p.opciones.length > 0)
                      ? <select style={styles.inp} value={resp[i] || ""} onChange={(e) => { const c = [...resp]; c[i] = e.target.value; setResp(c); }}>
                          <option value="">— elige —</option>{p.opciones.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      : <input style={styles.inp} value={resp[i] || ""} onChange={(e) => { const c = [...resp]; c[i] = e.target.value; setResp(c); }} />
                  )}
                  {p.tipo === "numero" && (
                    <input type="number" style={styles.inp} value={resp[i] ?? ""} onChange={(e) => { const c = [...resp]; c[i] = e.target.value; setResp(c); }} />
                  )}
                  {p.tipo === "equipo_puesto" && (p.puestos || []).map((puesto, s) => (
                    <div key={s} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                      <span style={{ minWidth: 50, fontSize: 12, color: C.accent }}>{puesto}</span>
                      <select style={{ ...styles.inp, flex: 1 }} value={(Array.isArray(resp[i]) && resp[i][s]) || ""} onChange={(e) => {
                        const c = [...resp]; const arr = Array.isArray(c[i]) ? [...c[i]] : []; arr[s] = e.target.value; c[i] = arr; setResp(c);
                      }}>
                        <option value="">— equipo —</option>{(p.opciones || []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              );
            })
          )}
          <button style={{ ...styles.btnPrimary, marginTop: 12 }} onClick={guardar}>GUARDAR VOTO DE {jugador.toUpperCase()}</button>
        </div>
      )}
    </div>
  );
}

function FilaPorra({ p, onGestionar, onChange, setMsg }) {
  const [confirm, setConfirm] = useState(null); // 'desc' | 'del' | null

  // Aviso: porra abierta cuyo cierre ya pasó (resultado pendiente de meter)
  const cierrePasado = !p.cerrada && p.cierra_en && new Date(p.cierra_en).getTime() < Date.now();

  const descalcular = async () => {
    const { error } = await descalcularPorra(p.id);
    if (error) setMsg(["err", error.message]);
    else setMsg(["ok", `Porra #${p.jornada} descalculada. Sus puntos se han retirado de la clasificación.`]);
    setConfirm(null); onChange();
  };
  const borrar = async () => {
    const { error } = await borrarPorra(p.id);
    if (error) setMsg(["err", error.message]);
    else setMsg(["ok", `Porra #${p.jornada} borrada.`]);
    setConfirm(null); onChange();
  };
  const duplicar = async () => {
    const copia = {
      temporada_id: temporada.id, jornada: (p.jornada || 0) + 1, tipo: p.tipo, comp: p.comp,
      modo: p.modo || "exacto", sede: p.sede, local: p.local, visitante: p.visitante,
      eliminatoria: p.eliminatoria, predicciones: p.predicciones,
      puntos_acierto: p.puntos_acierto, puntos_unico: p.puntos_unico, puntos_aprox: p.puntos_aprox,
    };
    const { error } = await supabase.from("porras").insert(copia);
    if (error) setMsg(["err", error.message]);
    else setMsg(["ok", `Porra duplicada como #${copia.jornada} (edítala si hace falta).`]);
    onChange();
  };

  return (
    <div style={{ padding: "8px 0", borderBottom: `1px solid ${C.line}`, fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>
          {p.jornada != null ? `#${p.jornada} · ` : <span style={{ color: C.accent }}>★ Especial · </span>}<b>{p.tipo === "partido" ? `${p.local} - ${p.visitante}` : (p.sede || p.comp)}</b>
          {p.eliminatoria && (
            p.pase_aqui
              ? <span style={{ fontSize: 10, color: C.gold, marginLeft: 6 }}>⚔ PARTIDO ÚNICO</span>
              : p.ida_id
                ? <span style={{ fontSize: 10, color: C.green, marginLeft: 6 }}>⚔ VUELTA (ida #{p.ida_id})</span>
                : <span style={{ fontSize: 10, color: C.accent, marginLeft: 6 }}>⚔ IDA · se vota el pase aquí</span>
          )}
          {p.tipo === "partido"
            ? <span style={{ opacity: 0.6 }}> · {p.comp}</span>
            : (p.sede ? <span style={{ opacity: 0.6 }}> · {p.comp}</span> : null)}
          {p.cerrada && <b style={{ color: C.gold }}> (cerrada)</b>}
          {cierrePasado && <b style={{ color: C.red }}> · ⚠ pendiente de resultado</b>}
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={styles.btnGhost} onClick={onGestionar}>Gestionar</button>
          <button style={{ ...styles.btnGhost, opacity: 0.8 }} onClick={duplicar}>Duplicar</button>
          {p.cerrada && <button style={styles.btnGhost} onClick={() => setConfirm(confirm === "desc" ? null : "desc")}>Descalcular</button>}
          <button style={{ ...styles.btnGhost, color: C.red, borderColor: "rgba(251,113,133,0.4)", opacity: 0.7 }} onClick={() => setConfirm(confirm === "del" ? null : "del")}>Borrar</button>
        </div>
      </div>
      {confirm === "desc" && (
        <div style={{ marginTop: 8, padding: 10, background: "rgba(252,211,77,0.08)", border: `1px solid rgba(252,211,77,0.3)`, borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: C.gold, marginBottom: 8 }}>Quitar los puntos de esta porra de la clasificación y reabrirla para votar. Se conservan los votos. ¿Seguro?</div>
          <button style={styles.btnGhost} onClick={descalcular}>Sí, descalcular</button>
        </div>
      )}
      {confirm === "del" && (
        <div style={{ marginTop: 8, padding: 10, background: "rgba(251,113,133,0.08)", border: `1px solid rgba(251,113,133,0.3)`, borderRadius: 10 }}>
          <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>Borrar la porra #{p.jornada} entera, con sus votos y puntos. No se puede deshacer. ¿Seguro?</div>
          <button style={{ ...styles.btnGhost, color: C.red }} onClick={borrar}>Sí, borrar definitivamente</button>
        </div>
      )}
    </div>
  );
}

// Permite añadir opciones a las predicciones de una especial ya abierta.
function EditarOpcionesPorra({ porra, onChange, setMsg }) {
  const inicial = (porra.predicciones || []).map((p) => typeof p === "string" ? { texto: p, tipo: "opcion", opciones: [] } : { ...p, opciones: p.opciones || [] });
  const [preds, setPreds] = useState(inicial);
  const [nuevas, setNuevas] = useState(inicial.map(() => ""));

  const editable = (p) => p.tipo === "opcion" || p.tipo === "equipo_puesto";

  const añadirOpcion = (i) => {
    const txt = (nuevas[i] || "").trim();
    if (!txt) return;
    // permitir añadir varias separadas por comas
    const nuevasOps = txt.split(",").map((o) => o.trim()).filter(Boolean);
    const c = [...preds];
    const existentes = c[i].opciones || [];
    c[i] = { ...c[i], opciones: [...existentes, ...nuevasOps.filter((o) => !existentes.includes(o))] };
    setPreds(c);
    const n = [...nuevas]; n[i] = ""; setNuevas(n);
  };

  const quitarOpcion = (i, op) => {
    const c = [...preds];
    c[i] = { ...c[i], opciones: c[i].opciones.filter((o) => o !== op) };
    setPreds(c);
  };

  const guardar = async () => {
    const { error } = await supabase.from("porras").update({ predicciones: preds }).eq("id", porra.id);
    if (error) setMsg(["err", error.message]);
    else { setMsg(["ok", "Opciones actualizadas."]); onChange(); }
  };

  return (
    <Plegable titulo="Editar opciones de las predicciones">
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>Añade opciones que se te olvidaron. Los votos ya emitidos no se ven afectados.</div>
      {preds.map((p, i) => (
        <div key={i} style={{ marginBottom: 12, padding: 10, background: "rgba(15,10,32,0.4)", borderRadius: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{p.texto} <span style={{ opacity: 0.5 }}>({p.tipo === "equipo_puesto" ? "equipos" : p.tipo})</span></div>
          {editable(p) ? (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {(p.opciones || []).map((o) => (
                  <span key={o} style={{ fontSize: 12, padding: "4px 8px", background: "rgba(183,148,255,0.15)", borderRadius: 8, display: "flex", gap: 6, alignItems: "center" }}>
                    {o}<button onClick={() => quitarOpcion(i, o)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14, padding: 0 }}>×</button>
                  </span>
                ))}
                {(p.opciones || []).length === 0 && <span style={{ fontSize: 12, opacity: 0.5 }}>Sin opciones (texto libre)</span>}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ ...styles.inp, fontSize: 13 }} value={nuevas[i] || ""} onChange={(e) => { const n = [...nuevas]; n[i] = e.target.value; setNuevas(n); }} placeholder="Nueva opción (o varias separadas por comas)" />
                <button style={styles.btnGhost} onClick={() => añadirOpcion(i)}>+ Añadir</button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.5 }}>Las predicciones numéricas no tienen opciones.</div>
          )}
        </div>
      ))}
      <button style={styles.btnPrimary} onClick={guardar}>Guardar opciones</button>
    </Plegable>
  );
}

// Edición de una porra ya creada (abierta). Permite todo, pero avisa cuando
// un cambio invalidaría votos ya emitidos. nVotos = votos actuales.
function EditarPorra({ porra, nVotos, equipos, onGuardado, setMsg }) {
  const esEspecial = porra.tipo === "especial";
  const pred0 = esEspecial ? ((porra.predicciones || [])[0] || {}) : null;
  const p0 = typeof pred0 === "string" ? { texto: pred0, tipo: "opcion", opciones: [] } : pred0;

  const [g, setG] = useState({
    jornada: porra.jornada ?? "",
    jornada_camp: porra.jornada_camp || "",
    comp: porra.comp || "",
    titulo: porra.sede || "",        // título de especiales (en sede) / sede de partidos
    local: porra.local || "",
    visitante: porra.visitante || "",
    tipoPred: p0?.tipo || "opcion",
    opciones: (p0?.opciones || []).join(", "),
    puestos: (p0?.puestos || []).join(", "),
    margen: p0?.margen ?? 1,
    etiqueta_aprox: p0?.etiqueta_aprox || "",
    p_aprox_ext: p0?.puntos_aprox_ext ?? "",
    p_unico_aprox_ext: p0?.puntos_unico_aprox_ext ?? "",
    p_exacto: p0?.puntos_exacto ?? "",
    p_unico: p0?.puntos_unico_exacto ?? "",
    p_aprox: p0?.puntos_aprox ?? "",
    p_unico_aprox: p0?.puntos_unico_aprox ?? "",
  });
  const [abierto, setAbierto] = useState(false);
  const [idaId, setIdaId] = useState(porra.ida_id ? String(porra.ida_id) : "");
  const [idas, setIdas] = useState([]);

  // Porras de ida disponibles de la temporada (eliminatorias que no son vuelta ni partido único)
  useEffect(() => {
    if (esEspecial || !porra.eliminatoria) return;
    supabase.from("porras").select("id, jornada, local, visitante, eliminatoria, ida_id, pase_aqui")
      .eq("temporada_id", porra.temporada_id).eq("tipo", "partido").eq("eliminatoria", true)
      .then(({ data }) => setIdas((data || []).filter((p) => p.id !== porra.id && !p.ida_id && !p.pase_aqui)));
  }, [porra.id, porra.temporada_id, porra.eliminatoria, esEspecial]);

  // Detectar cambios peligrosos respecto al original
  const peligros = [];
  if (nVotos > 0) {
    if (!esEspecial) {
      if (g.local !== (porra.local || "") || g.visitante !== (porra.visitante || ""))
        peligros.push("Cambiar los equipos invalida los votos de 'quién pasa' ya emitidos.");
    } else {
      if (g.tipoPred !== (p0?.tipo || "opcion"))
        peligros.push("Cambiar el tipo de predicción hace que los votos guardados (con el formato antiguo) no se calculen bien.");
      const opsOriginal = (p0?.opciones || []);
      const opsNuevas = g.opciones.split(",").map((o) => o.trim()).filter(Boolean);
      const quitadas = opsOriginal.filter((o) => !opsNuevas.includes(o));
      if (quitadas.length > 0)
        peligros.push(`Quitas opciones (${quitadas.join(", ")}) que algún jugador podría haber votado.`);
    }
  }

  const guardar = async () => {
    const upd = { jornada: g.jornada === "" ? null : +g.jornada, comp: g.comp, jornada_camp: g.jornada_camp || null };
    if (esEspecial) {
      upd.sede = g.titulo;
      // reconstruir la predicción única conservando los puntos existentes
      const nueva = { ...p0, texto: g.titulo, tipo: g.tipoPred };
      if (g.tipoPred === "opcion") { nueva.opciones = g.opciones.split(",").map((o) => o.trim()).filter(Boolean); delete nueva.puestos; }
      if (g.tipoPred === "equipo_puesto") {
        nueva.opciones = g.opciones.split(",").map((o) => o.trim()).filter(Boolean);
        nueva.puestos = g.puestos.split(",").map((o) => o.trim()).filter(Boolean);
      }
      if (g.tipoPred === "numero") { nueva.margen = +g.margen || 0; }
      // puntos de la predicción (si se dejan vacíos, se conserva lo que hubiera)
      const numOrKeep = (v, actual) => (v === "" || v == null || isNaN(+v)) ? actual : +v;
      nueva.puntos_exacto = numOrKeep(g.p_exacto, p0?.puntos_exacto);
      nueva.puntos_unico_exacto = numOrKeep(g.p_unico, p0?.puntos_unico_exacto ?? nueva.puntos_exacto);
      nueva.puntos_aprox = numOrKeep(g.p_aprox, p0?.puntos_aprox);
      // si se deja vacío, el único vale lo mismo que la base (nunca un +1 oculto)
      nueva.puntos_unico_aprox = numOrKeep(g.p_unico_aprox, p0?.puntos_unico_aprox ?? nueva.puntos_aprox);
      nueva.etiqueta_aprox = (g.etiqueta_aprox || "").trim() || null;
      // puntos del equipo de aproximación (el que se quedó fuera): si se dejan
      // vacíos, heredan los de "otro puesto" como hasta ahora
      nueva.puntos_aprox_ext = numOrKeep(g.p_aprox_ext, p0?.puntos_aprox_ext ?? nueva.puntos_aprox);
      nueva.puntos_unico_aprox_ext = numOrKeep(g.p_unico_aprox_ext, p0?.puntos_unico_aprox_ext ?? nueva.puntos_aprox_ext);
      upd.predicciones = [nueva];
    } else {
      upd.sede = g.titulo; upd.local = g.local; upd.visitante = g.visitante;
      if (porra.eliminatoria) upd.ida_id = idaId ? +idaId : null;
    }
    const { error } = await supabase.from("porras").update(upd).eq("id", porra.id);
    if (error) setMsg(["err", error.message]);
    else { setMsg(["ok", "Porra actualizada."]); onGuardado(); }
  };

  return (
    <Plegable titulo="✏️ Editar porra">
      {nVotos > 0 && (
        <div style={{ fontSize: 12, color: C.gold, marginBottom: 10, padding: 8, background: "rgba(252,211,77,0.08)", borderRadius: 8 }}>
          Esta porra ya tiene <b>{nVotos} voto(s)</b>. Los cambios de texto, fecha o jornada son seguros; cambiar estructura puede invalidarlos.
        </div>
      )}
      <Label>Jornada{esEspecial ? " (vacío = sin número hasta cerrar)" : ""}</Label>
      <input style={styles.inp} value={g.jornada} onChange={(e) => setG({ ...g, jornada: e.target.value })} />
      <Label>Competición</Label>
      <input style={styles.inp} value={g.comp} onChange={(e) => setG({ ...g, comp: e.target.value })} />
      <Label>Jornada del campeonato (opcional)</Label>
      <input style={styles.inp} value={g.jornada_camp} onChange={(e) => setG({ ...g, jornada_camp: e.target.value })}
        placeholder="Ej. J12, Cuartos, Final" />
      {esEspecial ? (
        <>
          <Label>Título de la porra</Label>
          <input style={styles.inp} value={g.titulo} onChange={(e) => setG({ ...g, titulo: e.target.value })} />
          <Label>Tipo de predicción</Label>
          <select style={styles.inp} value={g.tipoPred} onChange={(e) => setG({ ...g, tipoPred: e.target.value })}>
            <option value="opcion">Opción de una lista</option>
            <option value="equipo_puesto">Equipo por puesto</option>
            <option value="numero">Número con margen</option>
          </select>
          {(g.tipoPred === "opcion" || g.tipoPred === "equipo_puesto") && (
            <>
              <Label>Opciones / equipos (separados por comas)</Label>
              <input style={styles.inp} value={g.opciones} onChange={(e) => setG({ ...g, opciones: e.target.value })} />
            </>
          )}
          {g.tipoPred === "equipo_puesto" && (
            <>
              <Label>Puestos (separados por comas)</Label>
              <input style={styles.inp} value={g.puestos} onChange={(e) => setG({ ...g, puestos: e.target.value })} />
            </>
          )}
          {g.tipoPred === "numero" && (
            <>
              <Label>Margen de aproximación ±</Label>
              <input style={{ ...styles.inp, width: 90 }} type="number" value={g.margen} onChange={(e) => setG({ ...g, margen: e.target.value })} />
            </>
          )}
          <Label>Cómo llamar a la aproximación en la imagen</Label>
          <input style={styles.inp} value={g.etiqueta_aprox} onChange={(e) => setG({ ...g, etiqueta_aprox: e.target.value })}
            placeholder="Ej. Subcampeón, Finalista, 4º clasificado" />
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
            Si lo dejas vacío aparecerá «APROX».
          </div>
          <Label>Puntos de esta predicción</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {[["p_exacto", "Puesto exacto"], ["p_unico", "Exacto único"],
              ["p_aprox", "Equipo en otro puesto"], ["p_unico_aprox", "Otro puesto único"],
              ["p_aprox_ext", "Equipo de aproximación"], ["p_unico_aprox_ext", "Aproximación única"]].map(([k, lbl]) => (
              <div key={k}>
                <span style={{ fontSize: 11, opacity: 0.7 }}>{lbl}</span>
                <input style={{ ...styles.inp, fontSize: 13 }} type="number" value={g[k]} placeholder="—"
                  onChange={(e) => setG({ ...g, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
            <b>Puesto exacto</b>: el equipo en el puesto correcto. <b>Otro puesto</b>: el equipo está
            entre los aciertos pero en distinto puesto. <b>Equipo de aproximación</b>: el que eliges
            aparte al resolver (p. ej. el que perdió el play off), en cualquier puesto.
            Los campos «único» premian a quien fue el único en apostar por ese equipo;
            si los dejas vacíos valen lo mismo que su base.
          </div>
        </>
      ) : (
        <>
          <Label>Sede</Label>
          <input style={styles.inp} value={g.titulo} onChange={(e) => setG({ ...g, titulo: e.target.value })} />
          <Label>Local</Label>
          <SelectOEscribe value={g.local} onChange={(v) => setG({ ...g, local: v })} opciones={equipos.map((e) => e.nombre)} placeholder="Equipo local" />
          <Label>Visitante</Label>
          <SelectOEscribe value={g.visitante} onChange={(v) => setG({ ...g, visitante: v })} opciones={equipos.map((e) => e.nombre)} placeholder="Equipo visitante" />
          {porra.eliminatoria && !porra.pase_aqui && (
            <>
              <Label>Porra de ida (si esta es la VUELTA)</Label>
              <select style={styles.inp} value={idaId} onChange={(e) => setIdaId(e.target.value)}>
                <option value="">— ninguna: el pase se vota en esta porra —</option>
                {idas.map((p) => (
                  <option key={p.id} value={p.id}>#{p.jornada} · {p.local} - {p.visitante}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
                Si la vinculas a su ida, al votar ya no se pedirá el pase otra vez: se usará el que cada uno votó en la ida.
              </div>
            </>
          )}
        </>
      )}

      {peligros.length > 0 && (
        <div style={{ marginTop: 12, padding: 10, background: "rgba(251,113,133,0.12)", border: `1px solid ${C.red}`, borderRadius: 10 }}>
          <div style={{ fontSize: 13, color: C.red, fontWeight: 700, marginBottom: 6 }}>⚠ Atención: cambios que afectan a votos</div>
          {peligros.map((t, i) => <div key={i} style={{ fontSize: 12, color: C.red, marginBottom: 4 }}>• {t}</div>)}
          <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>Si continúas, revisa los votos afectados antes de calcular.</div>
        </div>
      )}

      <button style={{ ...styles.btnPrimary, marginTop: 14 }} onClick={guardar}>Guardar cambios</button>
    </Plegable>
  );
}

// ===== PANEL DE PENDIENTES DEL ADMIN =====
// Avisa de lo que falta por hacer: porras vencidas sin cerrar, cerradas sin calcular,
// y porras a punto de cerrar con votos incompletos.
function PendientesAdmin({ temporada, porras, onIr }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    (async () => {
      const ids = porras.map((p) => p.id);
      let votos = [], resultados = [];
      if (ids.length) {
        const [{ data: vs }, { data: rs }] = await Promise.all([
          supabase.from("votos").select("porra_id, jugador").in("porra_id", ids),
          supabase.from("resultados_porra").select("porra_id").in("porra_id", ids),
        ]);
        votos = vs || []; resultados = rs || [];
      }
      const parts = await getParticipantes(temporada.id);
      const conResultado = new Set(resultados.map((r) => r.porra_id));
      const votosPorPorra = {};
      votos.forEach((v) => { (votosPorPorra[v.porra_id] = votosPorPorra[v.porra_id] || []).push(v.jugador); });
      const ahora = Date.now();

      const vencidas = porras.filter((p) => !p.cerrada && p.cierra_en && new Date(p.cierra_en).getTime() <= ahora);
      const sinCalcular = porras.filter((p) => p.cerrada && !conResultado.has(p.id));
      const proximas = porras.filter((p) => {
        if (p.cerrada || !p.cierra_en) return false;
        const ms = new Date(p.cierra_en).getTime() - ahora;
        if (ms <= 0 || ms > 24 * 3600 * 1000) return false;
        return (votosPorPorra[p.id] || []).length < parts.length;
      }).map((p) => ({ ...p, faltan: parts.length - (votosPorPorra[p.id] || []).length }));

      setInfo({ vencidas, sinCalcular, proximas });
    })();
  }, [temporada.id, porras]);

  if (!info) return null;
  const total = info.vencidas.length + info.sinCalcular.length + info.proximas.length;

  const nombre = (p) => p.tipo === "partido" ? `${p.local} - ${p.visitante}` : (p.sede || p.comp);
  const etiqueta = (p) => p.jornada != null ? `#${p.jornada}` : "★";

  if (total === 0) {
    return (
      <Card>
        <div style={{ fontSize: 13, color: C.green }}>✓ Todo al día. No hay nada pendiente.</div>
      </Card>
    );
  }

  const Bloque = ({ titulo, lista, color, extra }) => lista.length === 0 ? null : (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 4 }}>{titulo}</div>
      {lista.map((p) => (
        <div key={p.id} onClick={() => onIr(p)} style={{
          cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8,
          padding: "7px 10px", marginBottom: 4, borderRadius: 8,
          background: "rgba(255,255,255,0.03)", border: `1px solid ${C.line}`, fontSize: 13,
        }}>
          <span>{etiqueta(p)} · {nombre(p)}{extra ? extra(p) : ""}</span>
          <span style={{ color: C.accent }}>Ir →</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <SectionTitle>⚠️ Pendientes ({total})</SectionTitle>
      <Bloque titulo="Ya cerraron y siguen abiertas — ciérralas y calcula" lista={info.vencidas} color={C.red} />
      <Bloque titulo="Cerradas sin calcular" lista={info.sinCalcular} color={C.gold} />
      <Bloque titulo="Cierran en menos de 24 h y faltan votos" lista={info.proximas} color={C.accent}
        extra={(p) => ` — faltan ${p.faltan}`} />
    </Card>
  );
}

// ===== CREAR PORRAS EN BLOQUE =====
// Pega una lista de partidos (uno por línea) y las crea todas de golpe.
function CrearEnBloque({ temporada, onCreadas, setMsg, porras }) {
  const [texto, setTexto] = useState("");
  const [comp, setComp] = useState("");
  const [creando, setCreando] = useState(false);

  const siguiente = (() => {
    const nums = porras.map((p) => p.jornada).filter((j) => j != null);
    return nums.length ? Math.max(...nums) + 1 : 1;
  })();

  const parsear = () => texto.split("\n").map((l) => l.trim()).filter(Boolean).map((linea) => {
    // formato: "Local - Visitante"  o  "Local - Visitante | 2026-08-15 20:00"
    const [parte, fecha] = linea.split("|").map((x) => x && x.trim());
    const m = parte.split(/\s+-\s+/);
    if (m.length < 2) return { error: linea };
    return { local: m[0].trim(), visitante: m[1].trim(), cierre: fecha || null };
  });

  const filas = texto.trim() ? parsear() : [];
  const validas = filas.filter((f) => !f.error);
  const erroneas = filas.filter((f) => f.error);

  const crear = async () => {
    if (!comp.trim()) { setMsg(["err", "Indica la competición."]); return; }
    if (validas.length === 0) { setMsg(["err", "No hay partidos válidos que crear."]); return; }
    setCreando(true);
    const registros = validas.map((f, i) => ({
      temporada_id: temporada.id,
      jornada: siguiente + i,
      tipo: "partido",
      comp: comp.trim(),
      modo: "exacto",
      local: f.local,
      visitante: f.visitante,
      cierra_en: f.cierre ? inputMadridAUTC(f.cierre.replace(" ", "T")) : null,
    }));
    const { error } = await supabase.from("porras").insert(registros);
    setCreando(false);
    if (error) setMsg(["err", error.message]);
    else {
      setMsg(["ok", `${registros.length} porras creadas (jornadas ${siguiente}–${siguiente + registros.length - 1}).`]);
      setTexto(""); onCreadas();
    }
  };

  return (
    <Plegable titulo="⚡ Crear varias porras de golpe">
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
        Un partido por línea, con el formato <b>Local - Visitante</b>.
        Puedes añadir la fecha de cierre tras una barra:
        <br /><code style={{ fontSize: 11 }}>Valladolid - Zaragoza | 2026-08-15 20:00</code>
      </div>
      <Label>Competición (para todas)</Label>
      <SelectOEscribe value={comp} onChange={setComp} opciones={[...new Set(porras.map((p) => p.comp).filter(Boolean))]} placeholder="Ej. La Liga Hypermotion" />
      <Label>Partidos</Label>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={7}
        placeholder={"Valladolid - Zaragoza\nEibar - Mirandés | 2026-08-16 18:30"}
        style={{ ...styles.inp, fontFamily: mono, fontSize: 13, resize: "vertical" }} />
      {filas.length > 0 && (
        <div style={{ fontSize: 12, marginTop: 6 }}>
          <span style={{ color: C.green }}>{validas.length} válidas</span>
          {erroneas.length > 0 && <span style={{ color: C.red }}> · {erroneas.length} sin el formato correcto</span>}
          {validas.length > 0 && <span style={{ opacity: 0.6 }}> · se numerarán desde la jornada {siguiente}</span>}
        </div>
      )}
      <button style={{ ...styles.btnPrimary, marginTop: 12 }} onClick={crear} disabled={creando}>
        {creando ? "Creando…" : `Crear ${validas.length || ""} porras`}
      </button>
    </Plegable>
  );
}

// ===== GUÍA DEL ADMINISTRADOR + COPIA DE SEGURIDAD =====
function GuiaAdmin({ setMsg }) {
  const [copiando, setCopiando] = useState(false);
  const [paso, setPaso] = useState("");

  const backup = async () => {
    setCopiando(true); setPaso("");
    try {
      const r = await descargarBackup((tabla, n) => setPaso(`${tabla}: ${n} filas`));
      setMsg(["ok", `Copia descargada: ${r.total} registros de ${r.tablas} tablas.`]);
    } catch (e) {
      setMsg(["err", "No se pudo generar la copia: " + e.message]);
    }
    setCopiando(false); setPaso("");
  };

  const PASOS = [
    ["1. Crear la porra", "Pestaña Porras → rellena jornada, competición y equipos. Pon la fecha de cierre para que se cierre sola. Si son varias, usa «Crear varias porras de golpe»."],
    ["2. Compartir el enlace", "Entra en la porra (botón Gestionar) y usa «Compartir por WhatsApp». Puedes generar antes una imagen de presentación."],
    ["3. Esperar los votos", "En la gestión ves quién ha votado, pero no su pronóstico: los votos no se destapan hasta cerrar la porra. Si alguien no tiene móvil a mano, abre su enlace y vota con su nombre y PIN."],
    ["4. Cerrar y calcular", "Cuando acabe el partido, mete el resultado real y pulsa CALCULAR. Eso reparte los puntos y actualiza la clasificación. Los votos quedan bloqueados."],
    ["5. Comentar la jornada", "Justo debajo aparece «Rachas y datos para el comentario»: úsalo para escribir el titular y el subcomentario."],
    ["6. Publicar las imágenes", "Genera la imagen de resultados y la de votos, y compártelas en el grupo."],
    ["7. Cerrar la temporada", "Pestaña Histórico → «Fin de temporada»: imágenes de campeón, resumen, palmarés y el Wrapped de cada jugador. En «Ajustes» asigna el campeón y dale su estrella (solo una vez)."],
  ];

  return (
    <>
      <Card>
        <SectionTitle>📘 Guía del administrador</SectionTitle>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
          El ciclo completo de una jornada, de principio a fin.
        </div>
        {PASOS.map(([t, d]) => (
          <div key={t} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.accent, marginBottom: 4 }}>{t}</div>
            <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>{d}</div>
          </div>
        ))}
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          <b>Reglas que conviene recordar:</b> el punto extra de eliminatoria se da en la vuelta;
          las porras especiales pueden crearse sin número de jornada y se numeran al cerrarlas;
          una porra ya calculada se puede «descalcular» si te equivocaste.
        </div>
      </Card>

      <Card>
        <SectionTitle>💾 Copia de seguridad</SectionTitle>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
          Descarga todos los datos (temporadas, porras, votos, resultados, clasificaciones y palmarés)
          en un archivo JSON. Guárdalo de vez en cuando, sobre todo al cerrar cada temporada.
        </div>
        <button style={styles.btnPrimary} onClick={backup} disabled={copiando}>
          {copiando ? `Descargando… ${paso}` : "💾 Descargar copia de seguridad"}
        </button>
      </Card>
    </>
  );
}

// ===== GALERÍA: histórico de imágenes generadas =====
function Galeria({ temporada, setMsg }) {
  const [imgs, setImgs] = useState(null);
  const [filtro, setFiltro] = useState("todas");
  const [confBorrar, setConfBorrar] = useState(null);

  const recargar = async () => setImgs(await listarImagenes(temporada?.id || null));
  useEffect(() => { recargar(); }, [temporada?.id]);

  if (!imgs) return <Spinner />;

  const TIPOS = [["todas", "Todas"], ["clasificacion", "Clasificaciones"], ["votos", "Votos"], ["promo", "Presentaciones"], ["especial", "Especiales"]];
  const lista = filtro === "todas" ? imgs : imgs.filter((i) => i.tipo === filtro);

  const borrar = async (img) => {
    const { error } = await borrarImagen(img);
    setConfBorrar(null);
    if (error) setMsg(["err", error.message]);
    else { setMsg(["ok", "Imagen borrada."]); recargar(); }
  };

  return (
    <Card>
      <SectionTitle>🗂 Histórico de imágenes ({imgs.length})</SectionTitle>
      <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 10 }}>
        Las imágenes que guardes al generarlas quedan aquí para reutilizarlas o volver a compartirlas.
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {TIPOS.map(([id, txt]) => (
          <button key={id} onClick={() => setFiltro(id)} style={{
            padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12,
            border: `1px solid ${filtro === id ? C.accent : C.panelBorder}`,
            background: filtro === id ? "rgba(183,148,255,0.15)" : "transparent",
            color: filtro === id ? C.ink : C.muted,
          }}>{txt}</button>
        ))}
      </div>

      {lista.length === 0
        ? <p style={{ fontSize: 12, opacity: 0.6 }}>No hay imágenes guardadas todavía. Genera una y pulsa «Guardar en histórico».</p>
        : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
            {lista.map((img) => (
              <div key={img.id} style={{ border: `1px solid ${C.line}`, borderRadius: 12, padding: 8, background: "rgba(15,10,32,0.5)" }}>
                <a href={img.url} target="_blank" rel="noreferrer">
                  <img src={img.url} alt={img.titulo || img.tipo} style={{ width: "100%", borderRadius: 8, display: "block" }} />
                </a>
                <div style={{ fontSize: 11, marginTop: 6, color: C.ink }}>{img.titulo || img.tipo}</div>
                <div style={{ fontSize: 10, opacity: 0.55 }}>
                  {new Date(img.creada).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  <a href={img.url} download style={{ ...styles.btnGhost, flex: 1, textAlign: "center", textDecoration: "none", padding: "3px 6px", fontSize: 11 }}>⬇</a>
                  {confBorrar === img.id ? (
                    <>
                      <button style={{ ...styles.btnGhost, padding: "3px 6px", fontSize: 11, color: C.red }} onClick={() => borrar(img)}>Sí</button>
                      <button style={{ ...styles.btnGhost, padding: "3px 6px", fontSize: 11 }} onClick={() => setConfBorrar(null)}>No</button>
                    </>
                  ) : (
                    <button style={{ ...styles.btnGhost, padding: "3px 6px", fontSize: 11, color: C.red }} onClick={() => setConfBorrar(img.id)}>🗑</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </Card>
  );
}

// ===== AUDITORÍA: puntos repartidos porra a porra =====
// Sirve para cotejar con el histórico antiguo y localizar la primera divergencia.
function Auditoria({ temporada }) {
  const [datos, setDatos] = useState(null);
  const [abierta, setAbierta] = useState(null);
  const [soloConPuntos, setSoloConPuntos] = useState(false);

  useEffect(() => {
    setDatos(null);
    (async () => {
      const [{ data: porras }, { data: res }, { data: base }] = await Promise.all([
        supabase.from("porras").select("*").eq("temporada_id", temporada.id).eq("cerrada", true),
        supabase.from("resultados_porra").select("*").eq("temporada_id", temporada.id),
        supabase.from("clasificacion").select("jugador, pt").eq("temporada_id", temporada.id),
      ]);
      const porId = {}; (porras || []).forEach((p) => { porId[p.id] = p; });
      const porPorra = {};
      (res || []).forEach((r) => { (porPorra[r.porra_id] = porPorra[r.porra_id] || []).push(r); });

      const orden = (porras || []).sort((a, b) => (a.jornada ?? 0) - (b.jornada ?? 0) || a.id - b.id);
      const basePt = (base || []).reduce((n, b) => n + (b.pt || 0), 0);
      let acum = basePt;
      const filas = orden.map((p) => {
        const rs = (porPorra[p.id] || []);
        const total = rs.reduce((n, r) => n + (r.pt || 0), 0);
        const totalSdp = rs.reduce((n, r) => n + (r.sdp || 0), 0);
        acum += total;
        return {
          porra: p, total, totalSdp, acumulado: acum,
          nPuntuaron: rs.filter((r) => (r.pt || 0) > 0).length,
          jugadores: rs.slice().sort((a, b) => (b.pt || 0) - (a.pt || 0) || a.jugador.localeCompare(b.jugador, "es")),
        };
      });
      setDatos({ filas, basePt });
    })();
  }, [temporada.id]);

  if (!datos) return <Spinner />;

  const etiqueta = (p) => `${p.jornada != null ? `#${p.jornada}` : "★"} · ${p.tipo === "partido" ? `${p.local} - ${p.visitante}` : (p.sede || p.comp)}`;
  const lista = soloConPuntos ? datos.filas.filter((f) => f.total > 0) : datos.filas;

  const descargarCsv = () => {
    const lineas = ["jornada;porra;jugador;tipo;puntos;sdp"];
    datos.filas.forEach((f) => f.jugadores.forEach((r) => {
      lineas.push([f.porra.jornada ?? "", etiqueta(f.porra).replace(/;/g, ","), r.jugador, r.tipo || "", r.pt || 0, r.sdp || 0].join(";"));
    }));
    const blob = new Blob(["\uFEFF" + lineas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `auditoria_temporada_${temporada.nombre}.csv`;
    a.click();
  };

  return (
    <Card>
      <SectionTitle>🔍 Auditoría de puntos</SectionTitle>
      <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10 }}>
        Puntos repartidos en cada porra, en orden. Compara la columna «reparte» con lo que dice
        tu histórico antiguo en esa misma jornada: la primera fila que no cuadre marca dónde
        empezó la divergencia. Toca una porra para ver el desglose por jugador.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <button style={styles.btnGhost} onClick={descargarCsv}>⬇ Descargar CSV</button>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.muted, cursor: "pointer" }}>
          <input type="checkbox" checked={soloConPuntos} onChange={(e) => setSoloConPuntos(e.target.checked)} />
          Ocultar porras sin puntos
        </label>
      </div>
      <div style={{ fontSize: 12, color: C.gold, marginBottom: 8 }}>
        Punto de partida (base importada): <b>{datos.basePt}</b> pts · {datos.filas.length} porras calculadas
      </div>

      <div style={{ display: "flex", fontSize: 11, color: C.muted, padding: "4px 8px", borderBottom: `1px solid ${C.line}` }}>
        <span style={{ flex: 1 }}>PORRA</span>
        <span style={{ width: 70, textAlign: "right" }}>REPARTE</span>
        <span style={{ width: 60, textAlign: "right" }}>PUNTÚAN</span>
        <span style={{ width: 80, textAlign: "right" }}>ACUMUL.</span>
      </div>
      {lista.map((f) => (
        <div key={f.porra.id}>
          <div onClick={() => setAbierta(abierta === f.porra.id ? null : f.porra.id)}
            style={{ display: "flex", alignItems: "center", cursor: "pointer", padding: "7px 8px",
              borderBottom: `1px solid ${C.line}`, fontSize: 13,
              background: abierta === f.porra.id ? "rgba(183,148,255,0.10)" : "transparent" }}>
            <span style={{ flex: 1 }}>{etiqueta(f.porra)}</span>
            <span style={{ width: 70, textAlign: "right", color: f.total > 0 ? C.green : C.muted, fontWeight: 700 }}>{f.total}</span>
            <span style={{ width: 60, textAlign: "right", color: C.muted }}>{f.nPuntuaron}</span>
            <span style={{ width: 80, textAlign: "right", fontFamily: mono, color: C.gold }}>{f.acumulado}</span>
          </div>
          {abierta === f.porra.id && (
            <div style={{ padding: "8px 12px", background: "rgba(15,10,32,0.55)", borderBottom: `1px solid ${C.line}` }}>
              {f.jugadores.length === 0
                ? <div style={{ fontSize: 12, opacity: 0.6 }}>Esta porra no tiene resultados registrados.</div>
                : f.jugadores.map((r) => (
                  <div key={r.jugador} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
                    <span>{r.jugador} <span style={{ opacity: 0.5 }}>({r.tipo || "—"}{r.extra ? " +E" : ""})</span></span>
                    <span>
                      <b style={{ color: (r.pt || 0) > 0 ? C.green : C.muted }}>{r.pt || 0} pts</b>
                      <span style={{ opacity: 0.5, marginLeft: 8 }}>{(r.sdp || 0).toLocaleString("es-ES")} SDP</span>
                    </span>
                  </div>
                ))}
              <div style={{ fontSize: 11, color: C.gold, marginTop: 6, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
                Total de la porra: {f.total} pts · {f.totalSdp.toLocaleString("es-ES")} SDP
              </div>
            </div>
          )}
        </div>
      ))}
    </Card>
  );
}
