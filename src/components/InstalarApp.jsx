import React, { useEffect, useState } from "react";
import { C, display, styles } from "../lib/theme.js";

// Invita a instalar la app.
// - Android/Chrome: usa el evento beforeinstallprompt (instalación con un toque).
// - iPhone/iPad: ese evento no existe, así que se explica el gesto manual.
// Si ya está instalada (modo standalone), no muestra nada.
export default function InstalarApp() {
  const [prompt, setPrompt] = useState(null);   // evento guardado (Android)
  const [esIOS, setEsIOS] = useState(false);
  const [verPasosIOS, setVerPasosIOS] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [instalada, setInstalada] = useState(false);

  useEffect(() => {
    // ¿ya está instalada / abierta como app?
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
    if (standalone) { setInstalada(true); return; }

    // ¿la ocultó el usuario en esta sesión?
    try { if (sessionStorage.getItem("ocultarInstalar") === "1") setOculto(true); } catch { /* ignora */ }

    const ua = window.navigator.userAgent || "";
    const iOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    setEsIOS(iOS);

    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalada = () => setInstalada(true);
    window.addEventListener("appinstalled", onInstalada);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalada);
    };
  }, []);

  const cerrar = () => {
    setOculto(true);
    try { sessionStorage.setItem("ocultarInstalar", "1"); } catch { /* ignora */ }
  };

  const instalar = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalada(true);
    setPrompt(null);
  };

  if (instalada || oculto) return null;
  if (!prompt && !esIOS) return null;   // navegador que no permite instalar

  return (
    <div style={{
      margin: "0 18px 16px", padding: "14px 16px", borderRadius: 16,
      background: "linear-gradient(135deg, rgba(124,92,240,0.22), rgba(124,92,196,0.06))",
      border: `1px solid ${C.panelBorder}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontFamily: display, fontSize: 14, fontWeight: 700 }}>📲 Instala la app</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            Ábrela desde tu pantalla de inicio, sin buscar el enlace en WhatsApp.
          </div>
        </div>
        <button onClick={cerrar} title="Ahora no" style={{
          background: "transparent", border: "none", color: C.muted,
          fontSize: 18, cursor: "pointer", padding: 4, lineHeight: 1,
        }}>×</button>
      </div>

      {prompt && (
        <button onClick={instalar} style={{ ...styles.btnPrimary, marginTop: 12 }}>
          Instalar ahora
        </button>
      )}

      {!prompt && esIOS && (
        <>
          <button onClick={() => setVerPasosIOS(!verPasosIOS)} style={{ ...styles.btnGhost, marginTop: 12 }}>
            {verPasosIOS ? "Ocultar pasos" : "Cómo añadirla en iPhone"}
          </button>
          {verPasosIOS && (
            <ol style={{ fontSize: 13, color: C.ink, margin: "10px 0 0", paddingLeft: 20, lineHeight: 1.7 }}>
              <li>Pulsa el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba).</li>
              <li>Baja y elige <b>Añadir a pantalla de inicio</b>.</li>
              <li>Confirma con <b>Añadir</b>.</li>
            </ol>
          )}
        </>
      )}
    </div>
  );
}
