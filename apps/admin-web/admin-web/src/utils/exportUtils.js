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
