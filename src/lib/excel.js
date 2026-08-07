import ExcelJS from "exceljs";
import { getEquipo } from "./equipos.js";

// Excel de clasificación con estética del grupo: cabecera morada,
// escudos de los equipos, resultado, tabla con colores por columna y
// comentarios de la jornada. Un solo título, sin duplicados.

const HEX = {
  bg: "FF3A2A5D", panel: "FF4A3570", dark: "FF2F2150",
  ink: "FFF4EEFE", accent: "FFC9B3FF", green: "FF3FB950",
  red: "FFF25C5C", gold: "FFFFD166", line: "FF6A4FA0",
};
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const font = (o = {}) => ({ name: "Arial", color: { argb: o.color || HEX.ink }, bold: !!o.bold, size: o.size || 11 });
const center = { horizontal: "center", vertical: "middle", wrapText: true };
const left = { horizontal: "left", vertical: "middle" };
const right = { horizontal: "right", vertical: "middle" };
const bl = { style: "thin", color: { argb: HEX.line } };
const borders = { top: bl, left: bl, bottom: bl, right: bl };

async function fetchImgBase64(url) {
  if (!url) return null;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const buf = await blob.arrayBuffer();
    let bin = "";
    new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
    const ext = (url.split(".").pop() || "png").split("?")[0].toLowerCase();
    return { base64: btoa(bin), ext: ext === "jpg" ? "jpeg" : ext };
  } catch { return null; }
}

export async function descargarExcel(porra, filas) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Clasificación", { views: [{ showGridLines: false }] });

  const widths = [6, 18, 7, 7, 7, 7, 7, 7, 7, 12, 9];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  const filasTotales = filas.length + 14;
  for (let r = 1; r <= filasTotales; r++)
    for (let c = 1; c <= 11; c++) ws.getCell(r, c).fill = fill(HEX.bg);

  // --- Bloque PORRA (A1:B4) ---
  ws.mergeCells("A1:B1");
  ws.getCell("A1").value = "PORRA";
  ws.getCell("A1").font = font({ color: HEX.accent, bold: true, size: 12 });
  ws.getCell("A1").alignment = center;
  ws.mergeCells("A2:B4");
  ws.getCell("A2").value = porra.jornada;
  ws.getCell("A2").font = font({ bold: true, size: 36 });
  ws.getCell("A2").alignment = center;
  for (let r = 1; r <= 4; r++) for (const c of [1, 2]) {
    ws.getCell(r, c).fill = fill(HEX.dark); ws.getCell(r, c).border = borders;
  }

  // --- Competición + resultado + (escudos) en C1:K4 ---
  ws.mergeCells("C1:K1");
  ws.getCell("C1").value = (porra.comp || "").toUpperCase();
  ws.getCell("C1").font = font({ color: HEX.accent, bold: true, size: 13 });
  ws.getCell("C1").alignment = center;

  ws.mergeCells("C2:K3");
  const esPartido = porra.tipo === "partido" && porra.resultado;
  ws.getCell("C2").value = esPartido
    ? `${porra.local}    ${porra.resultado.local} — ${porra.resultado.visitante}    ${porra.visitante}`
    : (porra.comp || "");
  ws.getCell("C2").font = font({ bold: true, size: 16 });
  ws.getCell("C2").alignment = center;

  // Línea de sede + pasa (solo si eliminatoria)
  ws.mergeCells("C4:K4");
  const sede = porra.sede || "";
  const pasa = (porra.eliminatoria && porra.resultado?.pasa) ? `    ·    PASA: ${porra.resultado.pasa}` : "";
  ws.getCell("C4").value = sede + pasa;
  ws.getCell("C4").font = font({ color: HEX.gold, size: 11 });
  ws.getCell("C4").alignment = center;

  for (let r = 1; r <= 4; r++) for (let c = 3; c <= 11; c++) {
    ws.getCell(r, c).fill = fill(HEX.panel); ws.getCell(r, c).border = borders;
  }

  // Escudos (si es partido y hay equipos con escudo)
  if (esPartido) {
    const [eqL, eqV] = await Promise.all([getEquipo(porra.local), getEquipo(porra.visitante)]);
    const imgL = await fetchImgBase64(eqL?.escudo_url);
    const imgV = await fetchImgBase64(eqV?.escudo_url);
    if (imgL) {
      const id = wb.addImage({ base64: imgL.base64, extension: imgL.ext });
      ws.addImage(id, { tl: { col: 2.2, row: 1.1 }, ext: { width: 44, height: 44 } });
    }
    if (imgV) {
      const id = wb.addImage({ base64: imgV.base64, extension: imgV.ext });
      ws.addImage(id, { tl: { col: 9.4, row: 1.1 }, ext: { width: 44, height: 44 } });
    }
  }

  // --- Comentario destacado (una sola vez, celdas combinadas, ajuste) ---
  let row = 6;
  if (porra.comentarios) {
    ws.mergeCells(`A${row}:K${row + 1}`);
    const cell = ws.getCell(`A${row}`);
    cell.value = porra.comentarios;
    cell.font = font({ color: HEX.gold, bold: true, size: 12 });
    cell.alignment = center;
    for (let rr = row; rr <= row + 1; rr++)
      for (let c = 1; c <= 11; c++) { ws.getCell(rr, c).fill = fill(HEX.dark); ws.getCell(rr, c).border = borders; }
    row += 3;
  }

  // --- Cabecera tabla ---
  const headers = ["#", "NOMBRE", "P", "AP", "D", "E", "Q", "U", "V", "SDP", "PT"];
  const headerRow = row;
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = h;
    cell.font = font({ color: HEX.accent, bold: true });
    cell.fill = fill(HEX.dark);
    cell.alignment = i <= 1 ? left : center;
    cell.border = borders;
  });

  // --- Filas ---
  filas.forEach((r, idx) => {
    const rr = headerRow + 1 + idx;
    const band = idx % 2 === 0 ? HEX.panel : HEX.bg;
    const vals = [`${idx + 1}º`, r.jugador, r.ptJornada || "", r.ap, r.d, r.e, r.q, r.u, r.v, r.sdp, r.pt];
    vals.forEach((v, i) => {
      const cell = ws.getCell(rr, i + 1);
      cell.value = v === "" ? null : v;
      cell.fill = fill(band);
      cell.border = borders;
      cell.alignment = i <= 1 ? left : right;
      cell.font = font();
    });
    ws.getCell(rr, 2).font = font({ bold: true });
    ws.getCell(rr, 5).font = font({ color: HEX.red });
    ws.getCell(rr, 7).font = font({ color: HEX.accent });
    ws.getCell(rr, 8).font = font({ color: HEX.gold, bold: true });
    ws.getCell(rr, 9).font = font({ color: HEX.green, bold: true });
    ws.getCell(rr, 11).font = font({ bold: true, size: 13 });
    ws.getCell(rr, 10).numFmt = "#,##0";
  });

  // Alturas
  ws.getRow(2).height = 30;
  ws.getRow(headerRow).height = 20;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `clasificacion_porra_${porra.jornada}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
