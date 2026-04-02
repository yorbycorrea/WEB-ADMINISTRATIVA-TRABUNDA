// ─────────────────────────────────────────────────────────────────────────────
//  exportUtils.js
//  Funciones para exportar datos de reportes a PDF y Excel.
//  Todo ocurre en el browser — no se necesita ningún servidor.
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const TIPO_LABELS = {
  APOYO_HORAS:    'Apoyo Horas',
  SANEAMIENTO:    'Saneamiento',
  TRABAJO_AVANCE: 'Trabajo Avance',
  CONTEO_RAPIDO:  'Conteo Rápido',
};

// Formatos de documento por tipo (para el encabezado del PDF)
const FORMATO_INFO = {
  APOYO_HORAS:    { titulo: 'PERSONAL POR HORAS (APOYOS)', codigo: 'COD-AP-01' },
  SANEAMIENTO:    { titulo: 'REPORTE DE SANEAMIENTO',      codigo: 'COD-SN-01' },
  TRABAJO_AVANCE: { titulo: 'REPORTE TRABAJO AVANCE',      codigo: 'COD-TA-01' },
  CONTEO_RAPIDO:  { titulo: 'CONTEO RÁPIDO DE PERSONAL',   codigo: 'COD-CR-01' },
};

function fmtCol(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function fmtValor(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Sí' : 'No';
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))
    return new Date(val).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  return TIPO_LABELS[val] ?? String(val);
}

function fmtHora(val) {
  if (!val) return '';
  // Si ya es HH:MM devuelve directo
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(val)) return val.substring(0, 5);
  // Si es ISO
  if (/^\d{4}-\d{2}-\d{2}T/.test(val))
    return new Date(val).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return String(val);
}

function fmtFechaCorta(val) {
  if (!val) return '';
  const d = new Date(val);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Encabezado institucional (igual en todos los formatos) ──────────────────
function dibujarEncabezado(doc, cabecera, ancho = 210) {
  const tipo  = cabecera.tipo_reporte;
  const info  = FORMATO_INFO[tipo] ?? { titulo: 'REPORTE', codigo: 'COD-00-01' };
  const fecha = fmtFechaCorta(cabecera.fecha);
  const hoy   = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const col1w = 40, col3w = 50, col2w = ancho - 28 - col1w - col3w;
  const x1 = 14, x2 = x1 + col1w, x3 = x2 + col2w;
  const yTop = 14, rowH = 7;

  // Bordes del encabezado — 3 celdas en fila
  doc.setLineWidth(0.3);
  doc.setDrawColor(100, 116, 139);
  // Celda empresa
  doc.rect(x1, yTop, col1w, rowH * 2);
  // Celda título formato
  doc.rect(x2, yTop, col2w, rowH * 2);
  // Celda código
  doc.rect(x3, yTop, col3w, rowH);
  doc.rect(x3, yTop + rowH, col3w, rowH);

  // Empresa
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('TRABUNDA SAC', x1 + col1w / 2, yTop + rowH, { align: 'center' });

  // Título del formato
  doc.setFontSize(9);
  doc.text('FORMATO', x2 + col2w / 2, yTop + 4.5, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(info.titulo, x2 + col2w / 2, yTop + rowH + 2, { align: 'center' });

  // Código / Versión / Fecha
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Código del formato: ${info.codigo}`, x3 + 2, yTop + 3.5);
  doc.text('Versión: 02', x3 + 2, yTop + 7.5);
  doc.text(`Fecha emisión: ${hoy}`, x3 + 2, yTop + rowH + 3.5);

  // Segunda fila — Planillero / Fecha / Turno
  const y2 = yTop + rowH * 2 + 1;
  doc.setLineWidth(0.3);
  doc.rect(x1, y2, col1w + col2w, rowH);
  doc.rect(x3, y2, col3w, rowH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`Planillero: `, x1 + 2, y2 + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(cabecera.creado_por_nombre ?? '—', x1 + 22, y2 + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('Turno: ', x1 + 2, y2 + rowH + 3);

  doc.setFont('helvetica', 'normal');
  doc.text(cabecera.turno ?? '—', x1 + 16, y2 + rowH + 3);

  doc.setFont('helvetica', 'bold');
  doc.text(`Fecha: `, x3 + 2, y2 + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(fecha, x3 + 16, y2 + 5);

  return y2 + rowH + 6; // Y donde empieza la tabla
}

// ─── Pie de firmas ────────────────────────────────────────────────────────────
function dibujarPie(doc, cabecera, yFinal, ancho = 210) {
  let y = yFinal + 8;

  // "Persona que elaboró..."
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(`PERSONA QUE ELABORÓ EL INFORME: ${(cabecera.creado_por_nombre ?? '').toUpperCase()}`, 14, y);
  y += 16;

  // Líneas de firma
  const lineW = 70;
  doc.setLineWidth(0.4);
  doc.setDrawColor(30, 41, 59);
  doc.line(14, y, 14 + lineW, y);
  doc.line(ancho - 14 - lineW, y, ancho - 14, y);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`PLANILLERO: ${(cabecera.creado_por_nombre ?? '').toUpperCase()}`, 14 + lineW / 2, y + 5, { align: 'center' });
  doc.text('PRODUCCIÓN', ancho - 14 - lineW / 2, y + 5, { align: 'center' });
}

// ─── PDF: APOYO_HORAS y SANEAMIENTO ──────────────────────────────────────────
function pdfApoyoHoras(cabecera, contenido) {
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const yTab = dibujarEncabezado(doc, cabecera);

  const lineas = contenido?.items ?? [];

  const head = [['N°', 'CÓDIGO', 'APELLIDOS Y NOMBRES', 'H.Ini', 'H.Fin', 'Tot. Hrs', 'ÁREA DE APOYO']];
  const body = lineas.map((l, idx) => [
    idx + 1,
    l.trabajador_codigo ?? '—',
    (l.trabajador_nombre ?? '—').toUpperCase(),
    fmtHora(l.hora_inicio),
    fmtHora(l.hora_fin),
    l.horas != null ? Number(l.horas).toFixed(1) : '0.0',
    (l.area_nombre ?? l.cuadrilla_nombre ?? '—').toUpperCase(),
  ]);

  autoTable(doc, {
    head, body,
    startY: yTab,
    margin: { left: 14, right: 14 },
    styles:      { fontSize: 8, cellPadding: 2, halign: 'center', lineColor: [100, 116, 139], lineWidth: 0.2 },
    headStyles:  { fillColor: [255, 255, 255], textColor: [30, 41, 59], fontStyle: 'bold', lineWidth: 0.3 },
    columnStyles: {
      0: { cellWidth: 8  },
      1: { cellWidth: 18 },
      2: { cellWidth: 60, halign: 'left' },
      3: { cellWidth: 16 },
      4: { cellWidth: 16 },
      5: { cellWidth: 18 },
      6: { halign: 'left' },
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    didParseCell: (data) => {
      // Resaltar en rojo las filas con horas = 0 (sin hora de salida)
      if (data.section === 'body' && data.column.index === 6) {
        const horas = parseFloat(body[data.row.index]?.[5]) || 0;
        if (horas === 0) data.cell.styles.textColor = [220, 38, 38];
      }
    },
  });

  const yFinal = doc.lastAutoTable.finalY ?? 200;
  dibujarPie(doc, cabecera, yFinal);

  doc.save(`trabunda-reporte-${cabecera.id}-${cabecera.tipo_reporte}.pdf`);
}

// ─── PDF: TRABAJO_AVANCE ──────────────────────────────────────────────────────
function pdfTrabajoAvance(cabecera, contenido) {
  const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const yTab = dibujarEncabezado(doc, cabecera);
  let y = yTab;

  const headStyles = { fillColor: [255, 255, 255], textColor: [30, 41, 59], fontStyle: 'bold', lineWidth: 0.3 };
  const tableStyles = { fontSize: 8, cellPadding: 2, lineColor: [100, 116, 139], lineWidth: 0.2 };

  // ── Recepción ────────────────────────────────────────────────────────────────
  if (contenido?.recepcion?.length) {
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(30, 41, 59);
    doc.text('RECEPCIÓN', 14, y); y += 3;
    autoTable(doc, {
      head: [['NOMBRE', 'H.Ini', 'H.Fin', 'KG']],
      body: contenido.recepcion.map(r => [r.nombre, fmtHora(r.hora_inicio), fmtHora(r.hora_fin), r.kg ?? '0']),
      startY: y, margin: { left: 14, right: 14 },
      styles: tableStyles, headStyles,
    });
    y = doc.lastAutoTable.finalY + 5;
  }

  // ── Fileteado ────────────────────────────────────────────────────────────────
  if (contenido?.fileteado?.lista?.length) {
    doc.setFont('helvetica', 'bold').setFontSize(9).text(
      `FILETEADO — Total KG: ${contenido.fileteado.totalKg ?? 0}`, 14, y); y += 3;
    autoTable(doc, {
      head: [['NOMBRE', 'H.Ini', 'H.Fin', 'KG']],
      body: contenido.fileteado.lista.map(r => [r.nombre, fmtHora(r.hora_inicio), fmtHora(r.hora_fin), r.kg ?? '0']),
      startY: y, margin: { left: 14, right: 14 },
      styles: tableStyles, headStyles,
    });
    y = doc.lastAutoTable.finalY + 5;
  }

  // ── Totales ──────────────────────────────────────────────────────────────────
  if (contenido?.totales) {
    const t = contenido.totales;
    autoTable(doc, {
      head: [['RECEPCIÓN (KG)', 'FILETEADO (KG)', 'APOYO RECEPCIÓN (KG)']],
      body: [[t.RECEPCION ?? 0, t.FILETEADO ?? 0, t.APOYO_RECEPCION ?? 0]],
      startY: y, margin: { left: 14, right: 14 },
      styles: { ...tableStyles, fontStyle: 'bold', halign: 'center' }, headStyles,
    });
    y = doc.lastAutoTable.finalY + 5;
  }

  dibujarPie(doc, cabecera, y);
  doc.save(`trabunda-reporte-${cabecera.id}-TRABAJO_AVANCE.pdf`);
}

// ─── PDF: CONTEO_RAPIDO ───────────────────────────────────────────────────────
function pdfConteoRapido(cabecera, contenido) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  // Para CONTEO_RAPIDO el backend ya devuelve la cabecera dentro de contenido
  const cab = contenido?.reporte ?? cabecera;
  const yTab = dibujarEncabezado(doc, cab);

  const items = contenido?.items ?? [];
  const total = items.reduce((s, i) => s + (i.cantidad || 0), 0);

  autoTable(doc, {
    head: [['ÁREA', 'CANTIDAD']],
    body: [
      ...items.map(i => [(i.area_nombre ?? '—').toUpperCase(), i.cantidad ?? 0]),
      [{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, { content: total, styles: { fontStyle: 'bold' } }],
    ],
    startY: yTab,
    margin: { left: 14, right: 14 },
    styles:     { fontSize: 9, cellPadding: 3, lineColor: [100, 116, 139], lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [30, 41, 59], fontStyle: 'bold', lineWidth: 0.3 },
    columnStyles: { 1: { halign: 'center', cellWidth: 30 } },
  });

  const y = doc.lastAutoTable.finalY + 5;
  dibujarPie(doc, cab, y);
  doc.save(`trabunda-reporte-${cab.id}-CONTEO_RAPIDO.pdf`);
}

// ─── Dispatcher principal ─────────────────────────────────────────────────────
/**
 * Genera el PDF del reporte completo según su tipo.
 * @param {Object} cabecera  - Datos del endpoint GET /reportes/:id
 * @param {Object} contenido - Datos del endpoint de detalle específico
 * @param {string} tipo      - tipo_reporte
 */
export function exportReporteDetallePDF(cabecera, contenido, tipo) {
  switch (tipo) {
    case 'APOYO_HORAS':
    case 'SANEAMIENTO':
      return pdfApoyoHoras(cabecera, contenido);
    case 'TRABAJO_AVANCE':
      return pdfTrabajoAvance(cabecera, contenido);
    case 'CONTEO_RAPIDO':
      return pdfConteoRapido(cabecera, contenido);
    default:
      // Fallback genérico si hay un tipo desconocido
      return pdfApoyoHoras(cabecera, contenido);
  }
}

// ─── PDF lista (todos los reportes de la página) ──────────────────────────────
export function exportToPDF(reportes, fecha, tipo) {
  if (!reportes.length) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('Trabunda — Reportes', 14, 14);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const tipoLabel = tipo ? (TIPO_LABELS[tipo] ?? tipo) : 'Todos los tipos';
  doc.text(`Fecha: ${fecha}  ·  Tipo: ${tipoLabel}  ·  Total: ${reportes.length}`, 14, 20);
  const ahora = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  doc.text(`Generado: ${ahora}`, 297 - 14, 20, { align: 'right' });

  const columnas  = Object.keys(reportes[0]).filter(k => k !== 'password');
  const cabeceras = columnas.map(fmtCol);
  const filas     = reportes.map(r => columnas.map(col => fmtValor(r[col])));

  autoTable(doc, {
    head: [cabeceras], body: filas, startY: 26,
    margin: { left: 14, right: 14 },
    styles:     { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${totalPaginas}`, 297 / 2, 205, { align: 'center' });
  }
  doc.save(`trabunda-reportes-${fecha}${tipo ? `-${tipo.toLowerCase()}` : ''}.pdf`);
}

// ─── Excel lista ──────────────────────────────────────────────────────────────
export function exportToExcel(reportes, fecha, tipo) {
  if (!reportes.length) return;
  const columnas  = Object.keys(reportes[0]).filter(k => k !== 'password');
  const cabecera  = columnas.map(fmtCol);
  const filas     = reportes.map(r => columnas.map(col => fmtValor(r[col])));
  const hoja      = XLSX.utils.aoa_to_sheet([cabecera, ...filas]);
  const libro     = XLSX.utils.book_new();
  hoja['!cols']   = columnas.map((col, i) => ({
    wch: Math.max(cabecera[i].length, ...filas.map(f => String(f[i] ?? '').length)) + 2,
  }));
  const tipoLabel = tipo ? (TIPO_LABELS[tipo] ?? tipo) : 'Todos';
  XLSX.utils.book_append_sheet(libro, hoja, tipoLabel.substring(0, 31));
  const meta = XLSX.utils.aoa_to_sheet([
    ['Proyecto', 'Trabunda'], ['Fecha', fecha], ['Tipo', tipoLabel],
    ['Total', reportes.length], ['Generado', new Date().toLocaleString('es-ES')],
  ]);
  XLSX.utils.book_append_sheet(libro, meta, 'Info');
  XLSX.writeFile(libro, `trabunda-reportes-${fecha}${tipo ? `-${tipo.toLowerCase()}` : ''}.xlsx`);
}
