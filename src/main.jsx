import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { C, mono, display } from "./lib/theme.js";

const Global = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Space+Mono:wght@400;700&display=swap');
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background:
        radial-gradient(900px 500px at 80% -10%, rgba(124,92,240,0.35), transparent 60%),
        radial-gradient(700px 500px at 0% 10%, rgba(180,148,255,0.18), transparent 55%),
        linear-gradient(180deg, ${C.bg}, ${C.bg2});
      background-attachment: fixed;
      color: ${C.ink};
      font-family: ${mono};
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    body::after {
      content: ""; position: fixed; inset: 0; pointer-events: none; opacity: 0.04; z-index: 1;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    }
    #root { position: relative; z-index: 2; }
    button { font-family: ${display}; }
    input, select { font-family: ${display}; }
    a { color: ${C.accent}; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  `}</style>
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Global />
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Registro del service worker (PWA instalable).
// updateViaCache:none + update() fuerza que se reemplace el sw viejo (que daba errores).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
      .then((reg) => reg.update())
      .catch(() => {});
  });
}
