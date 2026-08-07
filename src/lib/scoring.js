// Lógica de puntuación — idéntica a la validada en el prototipo.

const norm = (s) => (s || "").toString().trim().toLowerCase();
const signo = (a, b) => (a > b ? 1 : a < b ? -1 : 0);

// PARTIDO ----------------------------------------------------
// votos: [{ jugador, contenido:{local,visitante,pasa} }]
// real: { local, visitante, pasa }
// Devuelve [{ jugador, base, tipo, extra, total, sdp }]
export function computePartido(votos, real) {
  const exactos = votos.filter(
    (x) => x.contenido.local === real.local && x.contenido.visitante === real.visitante
  );
  const soloUno = exactos.length === 1;

  const rows = votos.map((x) => {
    const c = x.contenido;
    const aciertaResultado = c.local === real.local && c.visitante === real.visitante;
    const aciertaGanador =
      signo(c.local, c.visitante) === signo(real.local, real.visitante);
    let base = 0, tipo = "d";
    if (aciertaResultado && soloUno) { base = 4; tipo = "u"; }
    else if (aciertaResultado) { base = 3; tipo = "v"; }
    else if (aciertaGanador) { base = 1; tipo = "q"; }
    const extra = real.pasa && c.pasa === real.pasa ? 1 : 0;
    return { jugador: x.jugador, base, tipo, extra, total: base + extra };
  });

  const repart = rows.reduce((s, r) => s + r.base, 0);
  rows.forEach((r) => { r.sdp = repart > 0 ? Math.round((r.base / repart) * 10000) : 0; });
  return rows;
}

// ESPECIAL (sistema flexible por predicción) ----------------
// porra.predicciones: [{ texto, tipo, puntos... , margen, opciones }]
//   tipo: "opcion" | "equipo_puesto" | "numero"
// Compatibilidad: si predicciones son strings (formato viejo), se tratan
// como tipo "opcion" con los puntos globales de la porra.
// votos: [{ jugador, contenido:{ resp:[...] } }]
//   resp[i] según tipo:
//     - opcion:        "respuesta"
//     - equipo_puesto: ["equipoPuesto1","equipoPuesto2",...] (un equipo por puesto)
//     - numero:        número
// real[i] según tipo:
//     - opcion:        "respuesta correcta"
//     - equipo_puesto: ["equipoReal1","equipoReal2",...] (orden real de puestos)
//     - numero:        número real
//
// Puntos por predicción (con defaults desde la porra):
//   p_exacto (def. puntos_acierto), p_unico_exacto (def. puntos_unico),
//   p_aprox  (def. puntos_aprox),   p_unico_aprox  (def. p_aprox+1)
export function computeEspecial(porra, votos, real) {
  const preds = (porra.predicciones || []).map((p, i) =>
    typeof p === "string" ? { texto: p, tipo: "opcion" } : p
  );
  const n = preds.length;

  const defExacto = porra.puntos_acierto ?? 4;
  const defUnicoExacto = porra.puntos_unico ?? 5;
  const defAprox = porra.puntos_aprox ?? 3;
  const defUnicoAprox = (porra.puntos_aprox ?? 3) + 1;

  const pcfg = (p) => ({
    exacto: p.puntos_exacto ?? defExacto,
    // Si la predicción define sus propios puntos pero no los de "único",
    // el único hereda ese mismo valor (sin sumar nada por sorpresa).
    unicoExacto: p.puntos_unico_exacto ?? (p.puntos_exacto != null ? p.puntos_exacto : defUnicoExacto),
    aprox: p.puntos_aprox ?? defAprox,
    unicoAprox: p.puntos_unico_aprox ?? (p.puntos_aprox != null ? p.puntos_aprox : defUnicoAprox),
    // Tercer nivel (solo equipo_puesto): equipo que se quedó fuera pero cerca.
    // Por defecto usa los MISMOS puntos que la aproximación configurada, para que
    // lo que se ve en el formulario sea lo que se aplica. Se puede afinar aparte
    // con puntos_aprox_ext / puntos_unico_aprox_ext si algún día hiciera falta.
    aproxExt: p.puntos_aprox_ext ?? p.puntos_aprox ?? defAprox,
    unicoAproxExt: p.puntos_unico_aprox_ext ?? p.puntos_unico_aprox
      ?? (p.puntos_aprox != null ? p.puntos_aprox : defUnicoAprox),
    margen: p.margen ?? 0,
  });

  // Evalúa una predicción para un voto: devuelve "exacto" | "aprox" | "fallo" + clave de "qué acertó" (para unicidad)
  const evaluar = (pred, respVoto, realPred) => {
    if (respVoto == null || respVoto === "") return { res: "fallo", clave: null };
    if (pred.tipo === "numero") {
      const v = Number(respVoto), r = Number(realPred);
      if (isNaN(v) || isNaN(r)) return { res: "fallo", clave: null };
      if (v === r) return { res: "exacto", clave: "x:" + v };
      if (Math.abs(v - r) <= (pred.margen ?? 0) && (pred.margen ?? 0) > 0) return { res: "aprox", clave: "a:" + v };
      return { res: "fallo", clave: null };
    }
    if (pred.tipo === "equipo_puesto") {
      // respVoto y realPred son arrays paralelos: equipo por puesto.
      // Se evalúa POR PUESTO; pero aquí 'pred' representa el conjunto.
      // Para simplificar, equipo_puesto se maneja fuera (por puesto). No debería llegar aquí.
      return { res: "fallo", clave: null };
    }
    // opcion
    // realPred puede ser un texto (solo acierto exacto) o un objeto
    // { exacto, aprox } para permitir una segunda respuesta que puntúa por aproximación
    // (por ejemplo: campeón = exacto, subcampeón = aproximación).
    const esObj = realPred != null && typeof realPred === "object" && !Array.isArray(realPred);
    const valExacto = esObj ? realPred.exacto : realPred;
    const valAprox = esObj ? realPred.aprox : null;
    if (valExacto != null && valExacto !== "" && norm(respVoto) === norm(valExacto)) {
      return { res: "exacto", clave: "x:" + norm(respVoto) };
    }
    if (valAprox != null && valAprox !== "" && norm(respVoto) === norm(valAprox)) {
      return { res: "aprox", clave: "a:" + norm(respVoto) };
    }
    return { res: "fallo", clave: null };
  };

  // Para unicidad necesitamos, por cada predicción (o sub-puesto), contar cuántos votos
  // lograron el mismo "acierto". Construimos primero una estructura de items evaluables:
  // cada item = { predIndex, sub, evalPorVoto: Map(jugador-> {res,clave}) }
  // Para equipo_puesto, cada puesto es un sub-item con su propia regla de exacto/aprox.

  // 1) Generar, por voto, la evaluación de cada item.
  const evalVoto = votos.map(() => []); // evalVoto[vIdx] = [{predIndex, sub, res, clave, cfg}]

  preds.forEach((pred, i) => {
    const cfg = pcfg(pred);
    if (pred.tipo === "equipo_puesto") {
      // real[i] puede ser un array (formato antiguo) o { lista:[...], aprox:"Equipo" }
      const rObj = real[i] != null && !Array.isArray(real[i]) && typeof real[i] === "object";
      const realArr = rObj ? (real[i].lista || []) : (Array.isArray(real[i]) ? real[i] : []);
      const equipoAproxExt = rObj ? (real[i].aprox || null) : null;
      const conjuntoReal = new Set(realArr.map(norm)); // equipos que están en el top real
      const puestos = realArr.length;
      for (let s = 0; s < puestos; s++) {
        votos.forEach((x, vIdx) => {
          const respArr = Array.isArray(x.contenido.resp[i]) ? x.contenido.resp[i] : [];
          const equipo = respArr[s];
          let res = "fallo", clave = null;
          if (equipo != null && equipo !== "") {
            // La unicidad se mide por EQUIPO (sin importar el puesto): clave sin 's'.
            if (norm(equipo) === norm(realArr[s])) { res = "exacto"; clave = "eq:" + norm(equipo); }
            else if (conjuntoReal.has(norm(equipo))) { res = "aprox"; clave = "eq:" + norm(equipo); }
            else if (equipoAproxExt && norm(equipo) === norm(equipoAproxExt)) { res = "aproxext"; clave = "eq:" + norm(equipo); }
          }
          evalVoto[vIdx].push({ predIndex: i, sub: s, res, clave, cfg });
        });
      }
    } else {
      votos.forEach((x, vIdx) => {
        const e = evaluar(pred, x.contenido.resp[i], real[i]);
        evalVoto[vIdx].push({ predIndex: i, sub: 0, res: e.res, clave: e.clave, cfg });
      });
    }
  });

  // 2) Contar unicidad por (predIndex, clave) SIN el puesto, de modo que
  // "único" = ningún OTRO jugador logró ese mismo acierto-equipo en la predicción.
  // Deduplicamos por jugador para que un mismo jugador no se cuente dos veces
  // si repitió equipo en dos puestos.
  const conteo = {};
  evalVoto.forEach((items, vIdx) => {
    const yaContados = new Set();
    items.forEach((it) => {
      if (it.res === "fallo" || !it.clave) return;
      const k = `${it.predIndex}|${it.clave}`;
      if (yaContados.has(k)) return; // mismo jugador, mismo equipo/predicción: cuenta 1 vez
      yaContados.add(k);
      conteo[k] = (conteo[k] || 0) + 1;
    });
  });

  // 3) Puntuar cada voto.
  const rows = votos.map((x, vIdx) => {
    let base = 0;
    evalVoto[vIdx].forEach((it) => {
      if (it.res === "fallo") return;
      const k = `${it.predIndex}|${it.clave}`;
      const unico = conteo[k] === 1;
      if (it.res === "exacto") base += unico ? it.cfg.unicoExacto : it.cfg.exacto;
      else if (it.res === "aprox") base += unico ? it.cfg.unicoAprox : it.cfg.aprox;
      else if (it.res === "aproxext") base += unico ? it.cfg.unicoAproxExt : it.cfg.aproxExt;
    });
    return { jugador: x.jugador, base, tipo: base > 0 ? "v" : "d", extra: 0, total: base };
  });

  const repart = rows.reduce((s, r) => s + r.base, 0);
  rows.forEach((r) => { r.sdp = repart > 0 ? Math.round((r.base / repart) * 10000) : 0; });
  return rows;
}

// APROXIMACIÓN (terminación 0–9, circular) ------------------
// Pensado para el gordo / 2º premio: se vota un dígito (0–9).
//   - acierto exacto: puntos_acierto (puntos_unico si único acertante)
//   - distancia circular 1 (vecinos, incl. 0<->9): puntos_aprox
// porra: { puntos_acierto, puntos_unico, puntos_aprox }
// votos: [{ jugador, contenido:{ digito: 0..9 } }]
// real: número entero del premio (se usa su último dígito) o el propio dígito
export function computeAproximacion(porra, votos, real) {
  const realDig = ((parseInt(real, 10) % 10) + 10) % 10; // último dígito, seguro 0–9
  const pAprox = porra.puntos_aprox != null ? porra.puntos_aprox : 1;

  const distCircular = (a, b) => {
    const d = Math.abs(a - b);
    return Math.min(d, 10 - d); // 0 y 9 son vecinos
  };

  const exactos = votos.filter((x) => Number(x.contenido.digito) === realDig);
  const soloUno = exactos.length === 1;

  const rows = votos.map((x) => {
    const dig = ((Number(x.contenido.digito) % 10) + 10) % 10;
    const d = distCircular(dig, realDig);
    let base = 0, tipo = "d";
    if (d === 0) { base = soloUno ? porra.puntos_unico : porra.puntos_acierto; tipo = soloUno ? "u" : "v"; }
    else if (d === 1) { base = pAprox; tipo = "q"; } // aproximación -> cuenta como "quiniela"
    return { jugador: x.jugador, base, tipo, extra: 0, total: base };
  });
  const repart = rows.reduce((s, r) => s + r.base, 0);
  rows.forEach((r) => { r.sdp = repart > 0 ? Math.round((r.base / repart) * 10000) : 0; });
  return rows;
}
