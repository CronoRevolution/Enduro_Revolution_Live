import React, { useState, useEffect } from "react";
import { C, styles } from "../lib/theme.js";
import { guardarImagen, guardarAuto } from "../lib/galeria.js";

// Convierte un dataURL en File para poder compartirlo como archivo.
function dataUrlAFile(dataUrl, nombre) {
  const [cab, b64] = dataUrl.split(",");
  const mime = (cab.match(/:(.*?);/) || [])[1] || "image/png";
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new File([buf], nombre, { type: mime });
}

/**
 * Botones de acción para una imagen ya generada:
 *  - Compartir (usa el menú nativo del móvil: WhatsApp, Telegram…)
 *  - Descargar
 * En escritorio, donde no existe compartir archivos, ofrece abrir WhatsApp Web
 * tras descargar la imagen, explicando el paso.
 */
export default function CompartirImagen({ dataUrl, nombre, texto = "", guardable = null }) {
  const [msg, setMsg] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardada, setGuardada] = useState(false);

  const [duplicada, setDuplicada] = useState(false);

  // Al generar una imagen se guarda sola en el histórico.
  // Si ya había una de ese tipo para esta porra, no la duplica: pregunta.
  useEffect(() => {
    if (!guardable || !dataUrl) return;
    let vivo = true;
    setGuardada(false); setDuplicada(false); setMsg(null);
    (async () => {
      const r = await guardarAuto({ dataUrl, ...guardable });
      if (!vivo) return;
      if (r.duplicado) setDuplicada(true);
      else if (r.error) setMsg("No se pudo guardar en el histórico: " + r.error.message);
      else setGuardada(true);
    })();
    return () => { vivo = false; };
  }, [dataUrl]); // eslint-disable-line

  const guardar = async () => {
    setGuardando(true); setMsg(null);
    const { error } = await guardarImagen({ dataUrl, ...guardable });
    setGuardando(false);
    if (error) setMsg("No se pudo guardar: " + error.message);
    else { setGuardada(true); setDuplicada(false); setMsg("Guardada como versión nueva."); }
  };

  const file = () => dataUrlAFile(dataUrl, nombre);
  const puedeCompartirArchivo = typeof navigator !== "undefined" &&
    navigator.canShare && navigator.canShare({ files: [file()] });

  const descargar = () => {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = nombre; a.click();
  };

  const compartir = async () => {
    setEnviando(true); setMsg(null);
    try {
      if (puedeCompartirArchivo) {
        await navigator.share({ files: [file()], text: texto || undefined });
      } else {
        // Sin API de compartir: descargamos y abrimos WhatsApp para adjuntarla
        descargar();
        window.open(`https://wa.me/?text=${encodeURIComponent(texto || "")}`, "_blank");
        setMsg("Imagen descargada. Adjúntala en el chat que acabas de abrir.");
      }
    } catch (e) {
      if (e && e.name !== "AbortError") setMsg("No se pudo compartir: " + e.message);
    }
    setEnviando(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button style={{ ...styles.btnPrimary, flex: 1, minWidth: 150 }} onClick={compartir} disabled={enviando}>
          {enviando ? "Abriendo…" : "📲 Compartir por WhatsApp"}
        </button>
        <button style={styles.btnGhost} onClick={descargar}>⬇ Descargar</button>
        {guardable && duplicada && (
          <button style={styles.btnGhost} onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "🗂 Guardar otra versión"}
          </button>
        )}
      </div>
      {guardable && guardada && (
        <div style={{ fontSize: 11, color: C.green, marginTop: 6 }}>✓ Guardada en el histórico de imágenes</div>
      )}
      {guardable && duplicada && (
        <div style={{ fontSize: 11, color: C.gold, marginTop: 6 }}>
          Ya había una imagen de este tipo para esta porra. Si la has regenerado, guarda otra versión.
        </div>
      )}
      {msg && <div style={{ fontSize: 11, color: C.gold, marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
