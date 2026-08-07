import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { listarTemporadas, recomponerClasificacion, sumarTitulo, getTotalesTemporada, getRecordsHistoricos } from "../lib/temporadas.js";
import { generarImagenCampeon, generarImagenCategoria, generarImagenTodasCategorias, generarImagenWrapped, generarImagenResumenTemporada, CATEGORIAS } from "../lib/imagenFinTemporada.js";
import { getPalmares } from "../lib/temporadas.js";
import { cargarDatosStats, gafeTalisman } from "../lib/estadisticas.js";
import { generarVideoWrapped } from "../lib/videoWrapped.js";
import { C, mono, styles } from "../lib/theme.js";
import { Card, SectionTitle, Label, Msg } from "./ui.jsx";

export default function HistoricoTemporadas({ setMsg }) {
  const [temporadas, setTemporadas] = useState([]);
  const [detalle, setDetalle] = useState(null);

  const recargar = async () => setTemporadas(await listarTemporadas());
  useEffect(() => { recargar(); }, []);

  return (
    <Card>
      <SectionTitle>Histórico de temporadas</SectionTitle>
      {temporadas.map((t) => (
        <FilaTemporada key={t.id} t={t} onChange={recargar} setMsg={setMsg}
          abrir={() => setDetalle(t)} />
      ))}
      {detalle && <DetalleTemporada temporada={detalle} onClose={() => setDetalle(null)} setMsg={setMsg} />}
    </Card>
  );
}

function FilaTemporada({ t, onChange, setMsg, abrir }) {
  const [editando, setEditando] = useState(false);
  const [media, setMedia] = useState(false);
  const [nombre, setNombre] = useState(t.nombre);
  const [campeon, setCampeon] = useState(t.campeon || "");
  const [confirmando, setConfirmando] = useState(false);
  const [textoConf, setTextoConf] = useState("");
  const [imgUrl, setImgUrl] = useState(null);
  const [imgTipo, setImgTipo] = useState("");
  const [confirmandoEstrella, setConfirmandoEstrella] = useState(false);

  const darEstrella = async () => {
    const filas = await recomponerClasificacion(t.id);
    const ganador = (campeon && campeon.trim()) || filas[0]?.jugador;
    if (!ganador) { setMsg(["err", "No hay campeón ni clasificación."]); return; }
    // si el campo campeón está vacío, lo fijamos al 1º para dejar constancia
    if (!campeon || !campeon.trim()) { setCampeon(ganador); await supabase.from("temporadas").update({ campeon: ganador }).eq("id", t.id); }
    const { error } = await sumarTitulo(ganador);
    if (error) setMsg(["err", error.message]);
    else setMsg(["ok", `⭐ Estrella añadida a ${ganador}. ¡Campeón de la temporada ${t.nombre}!`]);
    setConfirmandoEstrella(false); onChange();
  };

  const genImagen = async (tipo) => {
    const filas = await recomponerClasificacion(t.id);
    if (!filas.length) { setMsg(["err", "Esta temporada no tiene clasificación."]); return; }
    let url;
    if (tipo === "campeon") url = generarImagenCampeon(t, filas);
    else if (tipo === "todas") url = generarImagenTodasCategorias(t, filas);
    else if (tipo === "resumen") {
      const [totales, records] = await Promise.all([getTotalesTemporada(t.id), getRecordsHistoricos(t.id)]);
      url = generarImagenResumenTemporada(t, totales, records);
    }
    else {
      const cat = CATEGORIAS.find((c) => c.key === tipo);
      url = generarImagenCategoria(t, filas, cat);
    }
    setImgUrl(url); setImgTipo(tipo);
  };

  const [wrappedJugador, setWrappedJugador] = useState("");
  const [nombresClasif, setNombresClasif] = useState([]);
  const cargarNombres = async () => {
    if (nombresClasif.length) return;
    const filas = await recomponerClasificacion(t.id);
    setNombresClasif(filas.map((f) => f.jugador));
  };
  const [videoInfo, setVideoInfo] = useState(null);
  const [generandoVideo, setGenerandoVideo] = useState(false);

  const datosWrapped = async () => {
    const filas = await recomponerClasificacion(t.id);
    const idx = filas.findIndex((f) => f.jugador === wrappedJugador);
    if (idx < 0) return null;
    const palmares = await getPalmares();
    const D = await cargarDatosStats(t.id);
    const gt = gafeTalisman(D)[wrappedJugador] || {};
    const pInfo = {}; D.porras.forEach((p) => { pInfo[p.id] = p.jornada ?? 0; });
    const evs = D.resultados.filter((r) => r.jugador === wrappedJugador)
      .sort((a, b) => (pInfo[a.porra_id] || 0) - (pInfo[b.porra_id] || 0));
    let rachaMax = 0, cur = 0, rachaVictoriasMax = 0, curV = 0;
    evs.forEach((e) => {
      if ((e.pt || 0) > 0) { cur++; rachaMax = Math.max(rachaMax, cur); } else cur = 0;
      if (e.tipo === "v" || e.tipo === "u") { curV++; rachaVictoriasMax = Math.max(rachaVictoriasMax, curV); } else curV = 0;
    });
    // resultado favorito (su marcador más votado) y el que más victorias le dio
    const partidos = {}; D.porras.filter((p) => p.tipo === "partido").forEach((p) => { partidos[p.id] = p; });
    const misVotos = D.votos.filter((v) => v.jugador === wrappedJugador && partidos[v.porra_id] && v.contenido?.local != null);
    const moda = (arr) => {
      if (!arr.length) return null;
      const c = {}; arr.forEach((x) => { c[x] = (c[x] || 0) + 1; });
      const [val, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
      return n >= 2 ? val : null;
    };
    const resultadoFavorito = moda(misVotos.map((v) => `${v.contenido.local}-${v.contenido.visitante}`));
    const aciertosExactos = misVotos.filter((v) => {
      const r = partidos[v.porra_id].resultado;
      return r && r.local === v.contenido.local && r.visitante === v.contenido.visitante;
    });
    const resultadoGanador = moda(aciertosExactos.map((v) => `${v.contenido.local}-${v.contenido.visitante}`));
    return {
      jugador: wrappedJugador, pos: idx + 1, total: filas.length, fila: filas[idx],
      titulos: palmares[wrappedJugador] || 0, rachaMax, rachaVictoriasMax,
      resultadoFavorito, resultadoGanador,
      talisman: gt.talisman && gt.talisman.pct >= 60 ? gt.talisman : null,
      gafe: gt.gafe && gt.gafe.pct <= 40 ? gt.gafe : null,
    };
  };

  const genWrapped = async () => {
    if (!wrappedJugador) { setMsg(["err", "Elige un jugador."]); return; }
    const datos = await datosWrapped();
    if (!datos) { setMsg(["err", "Ese jugador no está en la clasificación."]); return; }
    setImgUrl(generarImagenWrapped(t, datos)); setImgTipo("wrapped_" + wrappedJugador);
  };

  const genVideo = async () => {
    if (!wrappedJugador) { setMsg(["err", "Elige un jugador."]); return; }
    const datos = await datosWrapped();
    if (!datos) { setMsg(["err", "Ese jugador no está en la clasificación."]); return; }
    setGenerandoVideo(true); setVideoInfo(null);
    setMsg(["ok", "Generando vídeo… En navegadores modernos tarda unos segundos; en antiguos, lo que dura el vídeo."]);
    try {
      const info = await generarVideoWrapped(t, datos);
      setVideoInfo(info);
      setMsg(["ok", info.metodo === "webcodecs" ? "Vídeo MP4 listo (modo rápido)." : "Vídeo listo (modo compatible)."]);
    } catch (e) {
      setMsg(["err", "No se pudo generar el vídeo en este navegador: " + e.message]);
    }
    setGenerandoVideo(false);
  };

  const guardar = async () => {
    await supabase.from("temporadas").update({ nombre, campeon }).eq("id", t.id);
    setMsg(["ok", "Temporada actualizada."]);
    setEditando(false); onChange();
  };

  const borrar = async () => {
    if (textoConf !== t.nombre) { setMsg(["err", "El nombre no coincide. No se ha borrado."]); return; }
    const { error } = await supabase.from("temporadas").delete().eq("id", t.id);
    if (error) { setMsg(["err", "No se pudo borrar: " + error.message]); return; }
    setMsg(["ok", `Temporada "${t.nombre}" borrada.`]);
    setConfirmando(false); onChange();
  };

  return (
    <div style={{ borderBottom: `1px solid ${C.line}`, padding: "10px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14 }}>
          <b>{t.nombre}</b>{t.activa ? <span style={{ color: C.green }}> · activa</span> : <span style={{ opacity: 0.5 }}> · archivada</span>}
          {t.campeon && <span style={{ color: C.gold }}> · 🏆 {t.campeon}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={styles.btnGhost} onClick={abrir}>Ver detalle</button>
          <button style={{ ...styles.btnGhost, color: C.gold, borderColor: "rgba(252,211,77,0.45)" }} onClick={() => setMedia(!media)}>
            {media ? "Cerrar" : "🎁 Fin de temporada"}
          </button>
          <button style={styles.btnGhost} onClick={() => setEditando(!editando)}>{editando ? "Cerrar" : "✏️ Ajustes"}</button>
          {!t.activa && <button style={{ ...styles.btnGhost, color: C.red }} onClick={() => setConfirmando(!confirmando)}>Borrar</button>}
        </div>
      </div>

      {editando && (
        <div style={{ marginTop: 10 }}>
          <Label>Nombre</Label>
          <input style={styles.inp} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Label>Campeón (si lo dejas vacío, se considera el 1º de la clasificación)</Label>
          <input style={styles.inp} value={campeon} onChange={(e) => setCampeon(e.target.value)} placeholder="Nombre del campeón" />
          <button style={{ ...styles.btnPrimary, marginTop: 10 }} onClick={guardar}>Guardar cambios</button>

          <div style={{ marginTop: 12, padding: 10, background: "rgba(252,211,77,0.08)", border: `1px solid rgba(252,211,77,0.3)`, borderRadius: 10 }}>
            <div style={{ fontSize: 12, color: C.gold, marginBottom: 8 }}>
              Al cerrar la temporada, dale su estrella al campeón ({(campeon && campeon.trim()) || "el 1º de la clasificación"}). Súmala <b>una sola vez</b>.
            </div>
            {confirmandoEstrella ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{ ...styles.btnGhost, color: C.gold }} onClick={darEstrella}>Sí, sumar estrella</button>
                <button style={styles.btnGhost} onClick={() => setConfirmandoEstrella(false)}>Cancelar</button>
              </div>
            ) : (
              <button style={styles.btnGhost} onClick={() => setConfirmandoEstrella(true)}>⭐ Dar estrella al campeón</button>
            )}
          </div>
        </div>
      )}

      {media && (
        <div style={{ marginTop: 10 }}>
          <Label>Imágenes de fin de temporada</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button style={styles.btnGhost} onClick={() => genImagen("campeon")}>🏆 Campeón</button>
            <button style={styles.btnGhost} onClick={() => genImagen("resumen")}>📊 Resumen de temporada</button>
            <button style={styles.btnGhost} onClick={() => genImagen("todas")}>📜 Palmarés (todas)</button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.65, margin: "10px 0 6px" }}>🎁 Resumen individual (Wrapped):</div>
          <div style={{ display: "flex", gap: 6 }}>
            <select style={styles.inp} value={wrappedJugador} onFocus={cargarNombres} onChange={(e) => setWrappedJugador(e.target.value)}>
              <option value="">— jugador —</option>
              {nombresClasif.map((j) => <option key={j}>{j}</option>)}
            </select>
            <button style={styles.btnGhost} onClick={genWrapped}>🖼 Imagen</button>
            <button style={styles.btnGhost} onClick={genVideo} disabled={generandoVideo}>{generandoVideo ? "Grabando…" : "🎬 Vídeo"}</button>
          </div>
          {videoInfo && (
            <div style={{ marginTop: 10 }}>
              <video src={videoInfo.url} controls playsInline style={{ width: "100%", maxWidth: 360, borderRadius: 12, border: `1px solid ${C.line}` }} />
              <div>
                <a href={videoInfo.url} download={`wrapped_${wrappedJugador}.${videoInfo.ext}`} style={{ ...styles.btnGhost, display: "inline-block", textDecoration: "none", marginTop: 8 }}>⬇ Descargar vídeo</a>
              </div>
            </div>
          )}
          <div style={{ fontSize: 11, opacity: 0.65, margin: "8px 0 6px" }}>O una imagen por categoría:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {CATEGORIAS.map((cat) => (
              <button key={cat.key} style={{ ...styles.btnGhost, fontSize: 11, padding: "6px 10px" }} onClick={() => genImagen(cat.key)}>{cat.emoji} {cat.titulo}</button>
            ))}
          </div>
          {imgUrl && (
            <div style={{ marginTop: 12 }}>
              <img src={imgUrl} alt="fin temporada" style={{ width: "100%", maxWidth: 360, borderRadius: 12, border: `1px solid ${C.line}` }} />
              <div><button style={{ ...styles.btnGhost, marginTop: 8 }} onClick={() => {
                const a = document.createElement("a"); a.href = imgUrl; a.download = `temporada_${t.nombre}_${imgTipo}.png`; a.click();
              }}>⬇ Descargar imagen</button></div>
            </div>
          )}
        </div>
      )}

      {confirmando && (
        <div style={{ marginTop: 10, padding: 12, background: "rgba(251,113,133,0.08)", border: `1px solid rgba(251,113,133,0.3)`, borderRadius: 10 }}>
          <div style={{ fontSize: 13, color: C.red, marginBottom: 8 }}>
            ⚠ Esto borra la temporada "{t.nombre}" y TODAS sus porras, votos y clasificación. No se puede deshacer.
            Escribe el nombre exacto para confirmar:
          </div>
          <input style={styles.inp} value={textoConf} onChange={(e) => setTextoConf(e.target.value)} placeholder={t.nombre} />
          <button style={{ ...styles.btnPrimary, marginTop: 10, background: C.red, boxShadow: "none" }} onClick={borrar}>BORRAR DEFINITIVAMENTE</button>
        </div>
      )}
    </div>
  );
}

function DetalleTemporada({ temporada, onClose, setMsg }) {
  const [clasif, setClasif] = useState([]);
  const [porras, setPorras] = useState([]);
  const [editIdx, setEditIdx] = useState(null);
  const [edit, setEdit] = useState({});

  const [real, setReal] = useState([]);
  const recargar = async () => {
    // clasificación REAL (base importada + resultados de las porras jugadas)
    setReal(await recomponerClasificacion(temporada.id));
    // base importada: es lo único editable a mano
    const { data: c } = await supabase.from("clasificacion").select("*").eq("temporada_id", temporada.id);
    setClasif((c || []).sort((a, b) => b.pt - a.pt || b.sdp - a.sdp));
    const { data: p } = await supabase.from("porras").select("*").eq("temporada_id", temporada.id).order("jornada", { ascending: false });
    setPorras(p || []);
  };
  useEffect(() => { recargar(); }, [temporada.id]);

  const empezarEdit = (i, fila) => { setEditIdx(i); setEdit({ ...fila }); };
  const guardarEdit = async () => {
    await supabase.from("clasificacion").update({
      ap: +edit.ap, d: +edit.d, e: +edit.e, q: +edit.q, u: +edit.u, v: +edit.v, sdp: +edit.sdp, pt: +edit.pt,
    }).eq("temporada_id", temporada.id).eq("jugador", edit.jugador);
    setMsg(["ok", `Corregido ${edit.jugador}.`]);
    setEditIdx(null); recargar();
  };

  const campos = ["ap", "d", "e", "q", "u", "v", "sdp", "pt"];

  return (
    <div style={{ marginTop: 16, padding: 14, background: "rgba(15,10,32,0.4)", borderRadius: 12, border: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <b>Detalle · {temporada.nombre}</b>
        <button style={styles.btnGhost} onClick={onClose}>Cerrar detalle</button>
      </div>

      {/* Clasificación REAL de la temporada (base + porras jugadas) */}
      <Label>Clasificación real de la temporada</Label>
      {real.length === 0
        ? <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>Sin datos todavía.</div>
        : (
          <div style={{ marginBottom: 16 }}>
            {real.map((f, i) => (
              <div key={f.jugador} style={{
                display: "flex", justifyContent: "space-between", padding: "5px 10px",
                borderBottom: `1px solid ${C.line}`, fontSize: 13,
                color: i === 0 ? C.gold : C.ink,
              }}>
                <span>{i + 1}. {f.jugador}</span>
                <span><b>{f.pt}</b> pts · {(f.sdp || 0).toLocaleString("es-ES")} SDP</span>
              </div>
            ))}
          </div>
        )}

      <div style={{ fontSize: 11, color: C.gold, padding: 8, marginBottom: 8,
        background: "rgba(252,211,77,0.08)", border: `1px solid rgba(252,211,77,0.3)`, borderRadius: 8 }}>
        ⚠️ Lo de abajo es la <b>base importada</b> (los puntos con los que arrancó la temporada antes de
        registrar porras en la app), no la clasificación actual. Edítala solo para corregir el histórico antiguo.
      </div>

      <Label>Clasificación (editable para corregir errores)</Label>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: mono }}>
          <thead>
            <tr style={{ color: C.accent }}>
              {["#", "Jugador", "AP", "D", "E", "Q", "U", "V", "SDP", "PT", ""].map((h) => (
                <th key={h} style={{ padding: 4, textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clasif.map((r, i) => (
              <tr key={r.jugador} style={{ borderTop: `1px solid ${C.line}` }}>
                <td style={{ padding: 4 }}>{i + 1}</td>
                <td style={{ padding: 4 }}>{r.jugador}</td>
                {editIdx === i ? (
                  <>
                    {campos.map((c) => (
                      <td key={c} style={{ padding: 2 }}>
                        <input style={{ ...styles.inp, width: 50, padding: 4, fontSize: 11 }} value={edit[c]}
                          onChange={(e) => setEdit({ ...edit, [c]: e.target.value })} />
                      </td>
                    ))}
                    <td style={{ padding: 2 }}><button style={styles.btnGhost} onClick={guardarEdit}>✓</button></td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: 4 }}>{r.ap}</td><td style={{ padding: 4 }}>{r.d}</td>
                    <td style={{ padding: 4 }}>{r.e}</td><td style={{ padding: 4 }}>{r.q}</td>
                    <td style={{ padding: 4 }}>{r.u}</td><td style={{ padding: 4 }}>{r.v}</td>
                    <td style={{ padding: 4 }}>{(r.sdp || 0).toLocaleString("es-ES")}</td>
                    <td style={{ padding: 4, fontWeight: 700 }}>{r.pt}</td>
                    <td style={{ padding: 2 }}><button style={styles.btnGhost} onClick={() => empezarEdit(i, r)}>✎</button></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Label>Porras de la temporada ({porras.length})</Label>
      {porras.length === 0 && <div style={{ fontSize: 12, opacity: 0.6 }}>Sin porras registradas.</div>}
      {porras.map((p) => (
        <div key={p.id} style={{ fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${C.line}` }}>
          <b>{p.jornada != null ? `#${p.jornada}` : "★ Especial"}</b> · {p.comp}
          {p.resultado && p.tipo === "partido" && (
            <span style={{ color: C.gold }}> · {p.resultado.local}-{p.resultado.visitante}{p.resultado.pasa ? ` (pasa ${p.resultado.pasa})` : ""}</span>
          )}
          {p.cerrada ? <span style={{ color: C.muted }}> · cerrada</span> : <span style={{ color: C.green }}> · abierta</span>}
        </div>
      ))}
    </div>
  );
}
