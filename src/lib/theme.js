// Tema "apuestas premium": morado profundo con atmósfera, tipografía con carácter.
export const C = {
  bg: "#1a1130",
  bg2: "#0f0a20",
  panel: "rgba(124,92,196,0.08)",
  panelSolid: "#241640",
  panelBorder: "rgba(168,138,232,0.18)",
  ink: "#f3eefe",
  muted: "#a594c8",
  accent: "#b794ff",
  accent2: "#7c5cf0",
  green: "#4ade80",
  red: "#fb7185",
  gold: "#fcd34d",
  line: "rgba(168,138,232,0.12)",
};
export const display = "'Bricolage Grotesque', system-ui, sans-serif";
export const mono = "'Space Mono', ui-monospace, Menlo, monospace";

export const styles = {
  card: {
    background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 18,
    padding: 18, marginBottom: 16, backdropFilter: "blur(8px)",
  },
  inp: {
    width: "100%", padding: 12, background: "rgba(15,10,32,0.6)",
    border: `1px solid ${C.panelBorder}`, borderRadius: 12, color: C.ink, fontSize: 15,
    fontFamily: display, outline: "none",
  },
  btnPrimary: {
    width: "100%", padding: 14, background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
    color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 14,
    letterSpacing: 0.3, cursor: "pointer", fontFamily: display,
    boxShadow: `0 8px 24px -8px ${C.accent2}`,
  },
  btnGhost: {
    padding: "10px 16px", background: "rgba(124,92,196,0.1)", color: C.accent,
    border: `1px solid ${C.panelBorder}`, borderRadius: 10, fontWeight: 600, fontSize: 13,
    cursor: "pointer", fontFamily: display,
  },
  td: { padding: "10px 8px", textAlign: "right", fontFamily: mono },
  pill: (active) => ({
    flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${active ? C.accent : C.panelBorder}`,
    background: active ? `linear-gradient(135deg, ${C.accent}, ${C.accent2})` : "transparent",
    color: active ? "#fff" : C.ink, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: display,
    transition: "all .15s ease",
  }),
};
