// ─────────────────────────────────────────────────────────────────────────────
//  exportUtils.js — Exportación a PDF y Excel desde el browser
// ─────────────────────────────────────────────────────────────────────────────

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; // agrega doc.autoTable al prototipo
import * as XLSX from 'xlsx';

const TIPO_LABELS = {
  APOYO_HORAS:    'Apoyo Horas',
  SANEAMIENTO:    'Saneamiento',
  TRABAJO_AVANCE: 'Trabajo Avance',
  CONTEO_RAPIDO:  'Conteo Rápido',
};

const FORMATO_TITULO = {
  APOYO_HORAS:    'FORMATO PERSONAL POR HORAS (APOYOS)',
  SANEAMIENTO:    'REPORTE DE SANEAMIENTO',
  TRABAJO_AVANCE: 'REPORTE TRABAJO AVANCE',
  CONTEO_RAPIDO:  'CONTEO RÁPIDO DE PERSONAL',
};

const FORMATO_COD = {
  APOYO_HORAS:    'COD-AP-01',
  SANEAMIENTO:    'COD-SN-01',
  TRABAJO_AVANCE: 'COD-TA-01',
  CONTEO_RAPIDO:  'COD-CR-01',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtHora(val) {
  if (!val) return '';
  if (/^\d{2}:\d{2}/.test(val)) return val.substring(0, 5);
  try { return new Date(val).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
  catch { return String(val); }
}

function fmtFecha(val) {
  if (!val) return '';
  try {
    const d = new Date(val);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
  } catch { return String(val); }
}

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

// ─── Encabezado institucional (usando autoTable para evitar dibujo manual) ───
function encabezadoInstitucion(doc, cabecera) {
  const tipo    = cabecera?.tipo_reporte ?? '';
  const titulo  = FORMATO_TITULO[tipo] ?? 'REPORTE';
  const codigo  = FORMATO_COD[tipo]    ?? 'COD-00-01';
  const fecha   = fmtFecha(cabecera?.fecha);
  const hoyStr  = fmtFecha(new Date().toISOString());
  const planillero = cabecera?.creado_por_nombre ?? '—';
  const turno      = cabecera?.turno ?? '—';

  // Fila 1: empresa | título | código
  autoTable(doc, {
    body: [[
      { content: 'TRABUNDA SAC', styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 10 } },
      { content: `FORMATO\n${titulo}`, styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 8 } },
      { content: `Código: ${codigo}\nVersión: 02\nFecha: ${hoyStr}`, styles: { halign: 'left', valign: 'middle', fontSize: 7 } },
    ]],
    startY: 12,
    margin: { left: 14, right: 14 },
    styles: { lineColor: [100, 116, 139], lineWidth: 0.3, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 50 } },
    theme: 'grid',
  });

  // Fila 2: planillero | turno | fecha
  autoTable(doc, {
    body: [[
      { content: `Planillero: ${planillero}`, styles: { fontStyle: 'normal', fontSize: 8 } },
      { content: `Turno: ${turno}`, styles: { fontStyle: 'normal', fontSize: 8 } },
      { content: `Fecha: ${fecha}`, styles: { fontStyle: 'normal', fontSize: 8, halign: 'right' } },
    ]],
    startY: doc.lastAutoTable.finalY,
    margin: { left: 14, right: 14 },
    styles: { lineColor: [100, 116, 139], lineWidth: 0.3, cellPadding: 2 },
    theme: 'grid',
  });

  return doc.lastAutoTable.finalY + 2;
}

// ─── Pie de firmas ────────────────────────────────────────────────────────────
function pieFirmas(doc, cabecera) {
  const planillero = (cabecera?.creado_por_nombre ?? '').toUpperCase();
  let y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 230;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`PERSONA QUE ELABORÓ EL INFORME: ${planillero}`, 14, y);

  y += 18;
  doc.setLineWidth(0.4);
  doc.setDrawColor(30, 41, 59);
  doc.line(14, y, 84, y);
  doc.line(126, y, 196, y);

  doc.setFontSize(8);
  doc.text(`PLANILLERO: ${planillero}`, 49, y + 5, { align: 'center' });
  doc.text('PRODUCCIÓN', 161, y + 5, { align: 'center' });
}

// ─── PDF: APOYO_HORAS y SANEAMIENTO ──────────────────────────────────────────
function pdfLineas(cabecera, contenido) {
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const lineas = contenido?.items ?? [];

  encabezadoInstitucion(doc, cabecera);

  const startY = doc.lastAutoTable.finalY + 2;

  autoTable(doc, {
    head: [['N°', 'CÓDIGO', 'APELLIDOS Y NOMBRES', 'H. Ini', 'H. Fin', 'Tot. Hrs', 'ÁREA']],
    body: lineas.map((l, i) => [
      i + 1,
      l.trabajador_codigo ?? '—',
      (l.trabajador_nombre ?? '—').toUpperCase(),
      fmtHora(l.hora_inicio),
      fmtHora(l.hora_fin),
      l.horas != null ? Number(l.horas).toFixed(1) : '0.0',
      (l.area_nombre ?? l.cuadrilla_nombre ?? '—').toUpperCase(),
    ]),
    startY,
    margin: { left: 14, right: 14 },
    styles:     { fontSize: 8, cellPadding: 2, lineColor: [100, 116, 139], lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [30, 41, 59], fontStyle: 'bold', lineWidth: 0.3, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 58, halign: 'left'   },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 18, halign: 'center' },
      6: { halign: 'left' },
    },
    theme: 'grid',
  });

  pieFirmas(doc, cabecera);
  doc.save(`trabunda-reporte-${cabecera.id}-${cabecera.tipo_reporte}.pdf`);
}

// ─── PDF: TRABAJO_AVANCE ──────────────────────────────────────────────────────
function pdfTrabajoAvance(cabecera, contenido) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  encabezadoInstitucion(doc, cabecera);

  const tableOpts = {
    margin: { left: 14, right: 14 },
    styles:     { fontSize: 8, cellPadding: 2, lineColor: [100, 116, 139], lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [30, 41, 59], fontStyle: 'bold', lineWidth: 0.3 },
    theme: 'grid',
  };

  // Recepción
  if (contenido?.recepcion?.length) {
    const y = doc.lastAutoTable.finalY + 4;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text('RECEPCIÓN', 14, y);
    autoTable(doc, {
      ...tableOpts,
      head: [['NOMBRE', 'H. Ini', 'H. Fin', 'KG']],
      body: contenido.recepcion.map(r => [r.nombre ?? '—', fmtHora(r.hora_inicio), fmtHora(r.hora_fin), r.kg ?? 0]),
      startY: y + 2,
    });
  }

  // Fileteado
  if (contenido?.fileteado?.lista?.length) {
    const y = doc.lastAutoTable.finalY + 6;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text(`FILETEADO — Total KG: ${contenido.fileteado.totalKg ?? 0}`, 14, y);
    autoTable(doc, {
      ...tableOpts,
      head: [['NOMBRE', 'H. Ini', 'H. Fin', 'KG']],
      body: contenido.fileteado.lista.map(r => [r.nombre ?? '—', fmtHora(r.hora_inicio), fmtHora(r.hora_fin), r.kg ?? 0]),
      startY: y + 2,
    });
  }

  // Totales
  if (contenido?.totales) {
    const t = contenido.totales;
    autoTable(doc, {
      ...tableOpts,
      head: [['RECEPCIÓN (KG)', 'FILETEADO (KG)', 'APOYO RECEPCIÓN (KG)']],
      body: [[t.RECEPCION ?? 0, t.FILETEADO ?? 0, t.APOYO_RECEPCION ?? 0]],
      startY: doc.lastAutoTable.finalY + 6,
      styles: { ...tableOpts.styles, fontStyle: 'bold', halign: 'center' },
    });
  }

  pieFirmas(doc, cabecera);
  doc.save(`trabunda-reporte-${cabecera.id}-TRABAJO_AVANCE.pdf`);
}

// ─── PDF: CONTEO_RAPIDO ───────────────────────────────────────────────────────
function pdfConteoRapido(cabecera, contenido) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const cab = contenido?.reporte ?? cabecera;
  encabezadoInstitucion(doc, cab);

  const items = contenido?.items ?? [];
  const total = items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);

  autoTable(doc, {
    head: [['ÁREA', 'CANTIDAD']],
    body: [
      ...items.map(i => [(i.area_nombre ?? '—').toUpperCase(), i.cantidad ?? 0]),
      [{ content: 'TOTAL', styles: { fontStyle: 'bold' } }, { content: total, styles: { fontStyle: 'bold', halign: 'center' } }],
    ],
    startY: doc.lastAutoTable.finalY + 2,
    margin: { left: 14, right: 14 },
    styles:     { fontSize: 9, cellPadding: 3, lineColor: [100, 116, 139], lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [30, 41, 59], fontStyle: 'bold', lineWidth: 0.3 },
    columnStyles: { 1: { halign: 'center', cellWidth: 30 } },
    theme: 'grid',
  });

  pieFirmas(doc, cab);
  doc.save(`trabunda-reporte-${cab.id}-CONTEO_RAPIDO.pdf`);
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export function exportReporteDetallePDF(cabecera, contenido, tipo) {
  if (!cabecera) throw new Error('Sin datos de cabecera del reporte');
  switch (tipo) {
    case 'APOYO_HORAS':
    case 'SANEAMIENTO':
      return pdfLineas(cabecera, contenido);
    case 'TRABAJO_AVANCE':
      return pdfTrabajoAvance(cabecera, contenido);
    case 'CONTEO_RAPIDO':
      return pdfConteoRapido(cabecera, contenido);
    default:
      return pdfLineas(cabecera, contenido);
  }
}

// ─── PDF lista completa ───────────────────────────────────────────────────────
export function exportToPDF(reportes, fecha, tipo) {
  if (!reportes.length) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Trabunda — Reportes', 14, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  const tipoLabel = tipo ? (TIPO_LABELS[tipo] ?? tipo) : 'Todos los tipos';
  doc.text(`Fecha: ${fecha}  ·  Tipo: ${tipoLabel}  ·  Total: ${reportes.length}`, 14, 20);
  doc.text(`Generado: ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`, 283, 20, { align: 'right' });

  const columnas  = Object.keys(reportes[0]).filter(k => k !== 'password');
  autoTable(doc, {
    head: [columnas.map(fmtCol)],
    body: reportes.map(r => columnas.map(col => fmtValor(r[col]))),
    startY: 26,
    margin: { left: 14, right: 14 },
    styles:     { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const totalPags = doc.getNumberOfPages();
  for (let i = 1; i <= totalPags; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${totalPags}`, 148.5, 205, { align: 'center' });
  }
  doc.save(`trabunda-reportes-${fecha}${tipo ? `-${tipo.toLowerCase()}` : ''}.pdf`);
}

// ─── Excel lista completa ─────────────────────────────────────────────────────
export function exportToExcel(reportes, fecha, tipo) {
  if (!reportes.length) return;
  const columnas = Object.keys(reportes[0]).filter(k => k !== 'password');
  const cabecera = columnas.map(fmtCol);
  const filas    = reportes.map(r => columnas.map(col => fmtValor(r[col])));
  const hoja     = XLSX.utils.aoa_to_sheet([cabecera, ...filas]);
  hoja['!cols']  = columnas.map((col, i) => ({
    wch: Math.max(cabecera[i].length, ...filas.map(f => String(f[i] ?? '').length)) + 2,
  }));
  const libro     = XLSX.utils.book_new();
  const tipoLabel = tipo ? (TIPO_LABELS[tipo] ?? tipo) : 'Todos';
  XLSX.utils.book_append_sheet(libro, hoja, tipoLabel.substring(0, 31));
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([
    ['Proyecto', 'Trabunda'], ['Fecha', fecha], ['Tipo', tipoLabel],
    ['Total', reportes.length], ['Generado', new Date().toLocaleString('es-ES')],
  ]), 'Info');
  XLSX.writeFile(libro, `trabunda-reportes-${fecha}${tipo ? `-${tipo.toLowerCase()}` : ''}.xlsx`);
}
