// ─────────────────────────────────────────────────────────────────────────────
//  exportUtils.js
//  Funciones para exportar datos de reportes a PDF y Excel.
//  Todo ocurre en el browser — no se necesita ningún servidor.
// ─────────────────────────────────────────────────────────────────────────────

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Tipos legibles para mostrar en los archivos exportados
const TIPO_LABELS = {
  APOYO_HORAS:    'Apoyo Horas',
  SANEAMIENTO:    'Saneamiento',
  TRABAJO_AVANCE: 'Trabajo Avance',
  CONTEO_RAPIDO:  'Conteo Rápido',
};

// Convierte snake_case a Título Legible
function fmtCol(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Formatea un valor para celda de tabla plana (sin objetos anidados)
function fmtValor(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'boolean') return val ? 'Sí' : 'No';
  if (typeof val === 'object') return JSON.stringify(val);
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    return new Date(val).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  }
  if (typeof val === 'string' && (val === 'APOYO_HORAS' || val === 'SANEAMIENTO' || val === 'TRABAJO_AVANCE' || val === 'CONTEO_RAPIDO')) {
    return TIPO_LABELS[val] ?? val;
  }
  return String(val);
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

/**
 * Genera y descarga un PDF con la tabla de reportes.
 * @param {Array}  reportes - Array de objetos (los reportes a exportar)
 * @param {string} fecha    - Fecha de los reportes (YYYY-MM-DD)
 * @param {string} tipo     - Tipo filtrado ('' = todos)
 */
export function exportToPDF(reportes, fecha, tipo) {
  if (!reportes.length) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // ── Encabezado ──────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);        // slate-900
  doc.rect(0, 0, 297, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Trabunda — Reportes', 14, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);     // slate-400
  const tipoLabel = tipo ? (TIPO_LABELS[tipo] ?? tipo) : 'Todos los tipos';
  doc.text(`Fecha: ${fecha}  ·  Tipo: ${tipoLabel}  ·  Total: ${reportes.length}`, 14, 20);

  // Fecha de generación (esquina derecha)
  const ahora = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  doc.text(`Generado: ${ahora}`, 297 - 14, 20, { align: 'right' });

  // ── Tabla ───────────────────────────────────────────────────────────────────
  const columnas = Object.keys(reportes[0]).filter(k => k !== 'password');
  const cabeceras = columnas.map(fmtCol);
  const filas     = reportes.map(r => columnas.map(col => fmtValor(r[col])));

  autoTable(doc, {
    head:       [cabeceras],
    body:       filas,
    startY:     26,
    margin:     { left: 14, right: 14 },
    styles:     { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' }, // blue-600
    alternateRowStyles: { fillColor: [248, 250, 252] },  // slate-50
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.1,
  });

  // ── Pie de página en cada hoja ──────────────────────────────────────────────
  const totalPaginas = doc.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${totalPaginas}`, 297 / 2, 205, { align: 'center' });
  }

  doc.save(`trabunda-reportes-${fecha}${tipo ? `-${tipo.toLowerCase()}` : ''}.pdf`);
}

// ─── PDF individual ───────────────────────────────────────────────────────────

/**
 * Genera un PDF de UN solo reporte, en formato ficha/documento.
 * @param {Object} reporte - El objeto del reporte individual
 */
export function exportSingleReportPDF(reporte) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const tipoLabel = TIPO_LABELS[reporte.tipo_reporte] ?? reporte.tipo_reporte ?? 'Reporte';
  const fechaRep  = reporte.fecha
    ? new Date(reporte.fecha).toLocaleDateString('es-ES', { dateStyle: 'long' })
    : '—';
  const ahora = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

  // ── Encabezado ───────────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Trabunda', 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Reporte #${reporte.id} — ${tipoLabel}`, 14, 20);
  doc.text(`Generado: ${ahora}`, 210 - 14, 20, { align: 'right' });

  // ── Ficha principal ──────────────────────────────────────────────────────────
  // Definimos los campos que queremos mostrar y en qué orden
  const CAMPOS = [
    { label: 'ID',              val: reporte.id },
    { label: 'Fecha',           val: fechaRep },
    { label: 'Turno',           val: reporte.turno ?? '—' },
    { label: 'Tipo de reporte', val: tipoLabel },
    { label: 'Área',            val: reporte.area_nombre ?? '—' },
    { label: 'Creado por',      val: reporte.creado_por_nombre ?? '—' },
    { label: 'Estado',          val: reporte.estado ?? '—' },
    { label: 'Activo',          val: reporte.activo ? 'Sí' : 'No' },
    { label: 'Creado el',       val: reporte.creado_en
        ? new Date(reporte.creado_en).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
        : '—' },
    { label: 'Cerrado el',      val: reporte.cerrado_en
        ? new Date(reporte.cerrado_en).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
        : '—' },
    { label: 'Vence el',        val: reporte.vence_en
        ? new Date(reporte.vence_en).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
        : '—' },
  ];

  // Renderizamos en dos columnas
  let y = 38;
  const col1x = 14, col2x = 110;
  const rowH  = 12;

  doc.setFontSize(9);

  CAMPOS.forEach((campo, idx) => {
    const x = idx % 2 === 0 ? col1x : col2x;
    if (idx % 2 === 0 && idx > 0) y += rowH;

    // Fondo alternado
    if (Math.floor(idx / 2) % 2 === 0) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(x - 2, y - 5, 90, rowH, 'F');
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(campo.label + ':', x, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(String(campo.val ?? '—'), x, y + 5);
  });

  y += rowH + 8;

  // ── Observaciones (bloque separado) ─────────────────────────────────────────
  if (reporte.observaciones) {
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(14, y, 182, 8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Observaciones', 16, y + 5.5);
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(9);

    // splitTextToSize divide el texto para que no se salga del margen
    const lines = doc.splitTextToSize(reporte.observaciones, 178);
    doc.text(lines, 16, y);
    y += lines.length * 5 + 6;
  }

  // ── Pie de página ────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Trabunda — Sistema de gestión operativa', 14, 290);
  doc.text(`Reporte #${reporte.id}`, 210 - 14, 290, { align: 'right' });

  doc.save(`trabunda-reporte-${reporte.id}-${reporte.tipo_reporte ?? 'detalle'}.pdf`);
}

// ─── Excel ────────────────────────────────────────────────────────────────────

/**
 * Genera y descarga un archivo .xlsx con los reportes.
 * @param {Array}  reportes - Array de objetos
 * @param {string} fecha    - Fecha de los reportes
 * @param {string} tipo     - Tipo filtrado
 */
export function exportToExcel(reportes, fecha, tipo) {
  if (!reportes.length) return;

  const columnas = Object.keys(reportes[0]).filter(k => k !== 'password');

  // Convertimos a array de arrays con cabecera legible
  const cabecera = columnas.map(fmtCol);
  const filas    = reportes.map(r => columnas.map(col => fmtValor(r[col])));

  // SheetJS espera un array donde el primer elemento es la cabecera
  const datos = [cabecera, ...filas];

  const hoja   = XLSX.utils.aoa_to_sheet(datos);
  const libro  = XLSX.utils.book_new();

  // Ajustamos el ancho de cada columna al contenido
  const anchos = columnas.map((col, i) => ({
    wch: Math.max(
      cabecera[i].length,
      ...filas.map(f => String(f[i] ?? '').length)
    ) + 2,
  }));
  hoja['!cols'] = anchos;

  const tipoLabel = tipo ? (TIPO_LABELS[tipo] ?? tipo) : 'Todos';
  XLSX.utils.book_append_sheet(libro, hoja, tipoLabel.substring(0, 31)); // max 31 chars para nombre de hoja

  // Hoja de metadatos
  const meta = XLSX.utils.aoa_to_sheet([
    ['Proyecto',  'Trabunda'],
    ['Fecha',     fecha],
    ['Tipo',      tipoLabel],
    ['Total',     reportes.length],
    ['Generado',  new Date().toLocaleString('es-ES')],
  ]);
  XLSX.utils.book_append_sheet(libro, meta, 'Info');

  XLSX.writeFile(libro, `trabunda-reportes-${fecha}${tipo ? `-${tipo.toLowerCase()}` : ''}.xlsx`);
}
