// ─────────────────────────────────────────────────────────────────────────────
//  exportUtils.js — Exportación a PDF y Excel desde el browser
// ─────────────────────────────────────────────────────────────────────────────

import jsPDFLib from 'jspdf';
import autoTableLib from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Compatibilidad CJS/ESM: jsPDF se resuelve directamente como función
const jsPDF = jsPDFLib?.jsPDF ?? jsPDFLib?.default?.jsPDF ?? jsPDFLib?.default ?? jsPDFLib;

// autoTable se importa como objeto namespace en producción; la función real está en .default
const autoTable = typeof autoTableLib === 'function'
  ? autoTableLib
  : (autoTableLib?.default ?? autoTableLib);

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
  APOYO_HORAS:    'TRABUNDA SAC -GG-JO-F-15',
  SANEAMIENTO:    'TRABUNDA SAC -GG-JO-F-10',
  TRABAJO_AVANCE: 'COD-TA-01',
  CONTEO_RAPIDO:  'COD-CR-01',
};

// Configuración fiel al formato físico original (por tipo de reporte).
// Solo los tipos aquí definidos usan este encabezado/pie especializado;
// el resto mantiene el comportamiento genérico previo.
const FORMATO_META = {
  APOYO_HORAS: {
    titulo:        'PERSONAL POR HORAS (APOYOS)',
    codigoLabel:   'Código del formato',
    codigo:        'COD-AP-01',
    version:       '02',
    fechaEmision:  '01/01/2026',
    mostrarPagina: false,
    ultimaCol:     'AREA DE APOYO',
    firmas:        ['PLANILLERO', 'PRODUCCIÓN', 'JEFE DE TURNO'],
    firmaCentral:  'GERENTE DE OPERACIONES',
  },
};

const TOTAL_PAGES_EXP = '{total_pages_count_string}';

const TURNO_LABELS = {
  1: 'Turno 1',
  2: 'Turno 2',
  3: 'Turno 3',
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
  const raw = String(val).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${d}/${m}/${y}`;
  }
  const slashMatch = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (slashMatch) {
    const [, y, m, d] = slashMatch;
    return `${d}/${m}/${y}`;
  }
  const localMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (localMatch) return `${localMatch[1]}/${localMatch[2]}/${localMatch[3]}`;
  try {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }
  } catch {}
  return raw;
}

function getTurnoNombre(item) {
  const nombre = item?.turno_nombre ?? item?.nombre_turno ?? item?.turno ?? item?.turno_label;
  if (nombre) return nombre;
  const idTurno = item?.id_turno ?? item?.turno_id;
  return idTurno ? (TURNO_LABELS[idTurno] ?? `Turno ${idTurno}`) : '—';
}

function getRutaNombre(item) {
  const nombre = item?.ruta_nombre ?? item?.nombre_ruta ?? item?.ruta ?? item?.ruta_label;
  if (nombre) return nombre;
  const idRuta = item?.id_ruta ?? item?.ruta_id;
  return idRuta ? `Ruta ${idRuta}` : '—';
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
  const meta    = FORMATO_META[tipo] ?? null;
  const titulo  = meta?.titulo ?? FORMATO_TITULO[tipo] ?? 'REPORTE';
  const codigo  = meta?.codigo ?? FORMATO_COD[tipo]    ?? 'COD-00-01';
  const fecha   = fmtFecha(cabecera?.fecha);
  const planillero = cabecera?.creado_por_nombre ?? '—';
  const turno      = cabecera?.turno ?? '—';
  const esSaneamiento = tipo === 'SANEAMIENTO';
  const bloqueCodigo = meta
    ? `${meta.codigoLabel}: ${codigo}\nVersión: ${meta.version}\nFecha emisión:${meta.fechaEmision}${meta.mostrarPagina ? `\nPágina: 1 de ${TOTAL_PAGES_EXP}` : ''}`
    : `Código: ${codigo}\nVersion: 03\nFecha emisión:Mayo 2026\nPágina: 1 de ${TOTAL_PAGES_EXP}`;

  // Fila 1: empresa | título | código
  autoTable(doc, {
    body: [[
      { content: 'TRABUNDA SAC', styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 10 } },
      { content: `FORMATO\n${titulo}`, styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 8 } },
      { content: bloqueCodigo, styles: { halign: 'left', valign: 'middle', fontSize: esSaneamiento ? 6.5 : 7, textColor: [0, 0, 0] } },
    ]],
    startY: 12,
    margin: { left: 14, right: 14 },
    styles: { lineColor: esSaneamiento ? [0, 0, 0] : [100, 116, 139], lineWidth: 0.3, cellPadding: esSaneamiento ? 1.6 : 3 },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 50 } },
    theme: 'grid',
  });

  // Fila 2: planillero/turno | fecha  (formato fiel al original)
  if (meta) {
    autoTable(doc, {
      body: [[
        { content: `Planillero: ${planillero}\nTurno: ${turno}`, styles: { fontStyle: 'normal', fontSize: 8, valign: 'top' } },
        { content: `Fecha: ${fecha}`, styles: { fontStyle: 'normal', fontSize: 8, halign: 'right', valign: 'top' } },
      ]],
      startY: doc.lastAutoTable.finalY,
      margin: { left: 14, right: 14 },
      styles: { lineColor: [100, 116, 139], lineWidth: 0.3, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 50 } },
      theme: 'grid',
    });
  } else {
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
  }

  return doc.lastAutoTable.finalY + 2;
}

// ─── Pie de firmas ────────────────────────────────────────────────────────────
function pieFirmas(doc, cabecera, startY) {
  const tipo = cabecera?.tipo_reporte ?? '';
  const meta = FORMATO_META[tipo] ?? null;
  const planillero = (cabecera?.creado_por_nombre ?? '').toUpperCase();
  let y = startY != null ? startY : (doc.lastAutoTable ? doc.lastAutoTable.finalY + 12 : 230);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`PERSONA QUE ELABORÓ EL INFORME: ${planillero}`, 14, y);

  doc.setLineWidth(0.4);
  doc.setDrawColor(30, 41, 59);

  // Formato fiel: fila de firmas + una firma central debajo
  if (meta?.firmas) {
    y += 22;
    const cols = [
      { x0: 14,  x1: 66,  cx: 40  },
      { x0: 79,  x1: 131, cx: 105 },
      { x0: 144, x1: 196, cx: 170 },
    ];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    meta.firmas.forEach((f, i) => {
      const c = cols[i] ?? cols[cols.length - 1];
      doc.line(c.x0, y, c.x1, y);
      const label = f === 'PLANILLERO' ? `PLANILLERO: ${planillero}` : f;
      doc.text(label, c.cx, y + 5, { align: 'center' });
    });
    if (meta.firmaCentral) {
      const cy = y + 22;
      doc.line(79, cy, 131, cy);
      doc.text(meta.firmaCentral, 105, cy + 5, { align: 'center' });
    }
    return;
  }

  // Comportamiento genérico previo (2 firmas)
  y += 18;
  doc.line(14, y, 84, y);
  doc.line(126, y, 196, y);
  doc.setFontSize(8);
  doc.text(`PLANILLERO: ${planillero}`, 49, y + 5, { align: 'center' });
  doc.text('PRODUCCIÓN', 161, y + 5, { align: 'center' });
}

// ─── PDF: APOYO_HORAS y SANEAMIENTO ──────────────────────────────────────────
function pdfLineas(cabecera, contenido, tipo) {
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const lineas = contenido?.items ?? [];
  const esSaneamiento = tipo === 'SANEAMIENTO';
  const meta   = FORMATO_META[tipo] ?? null;
  const ultimaColHeader = meta?.ultimaCol ?? (esSaneamiento ? 'LABORES REALIZADAS' : 'ÁREA');
  const hIni = meta ? 'H.Ini' : 'H. Ini';
  const hFin = meta ? 'H.Fin' : 'H. Fin';

  encabezadoInstitucion(doc, cabecera);

  const startY = doc.lastAutoTable.finalY + 2;

  autoTable(doc, {
    head: [['N°', 'CÓDIGO', 'APELLIDOS Y NOMBRES', hIni, hFin, 'Tot. Hrs', ultimaColHeader]],
    body: lineas.map((l, i) => [
      i + 1,
      l.trabajador_codigo ?? '—',
      (l.trabajador_nombre ?? '—').toUpperCase(),
      fmtHora(l.hora_inicio),
      fmtHora(l.hora_fin),
      l.horas != null ? Number(l.horas).toFixed(1) : '0.0',
      esSaneamiento
        ? (l.labores ?? '—')
        : (l.area_nombre ?? l.cuadrilla_nombre ?? '—').toUpperCase(),
    ]),
    startY,
    margin: { left: 14, right: 14 },
    styles:     { fontSize: 8, cellPadding: meta ? 1.4 : 2, lineColor: [100, 116, 139], lineWidth: 0.2 },
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

  // Observaciones del reporte (encabezado + lista, sin recuadro — fiel al original)
  let yFin = doc.lastAutoTable.finalY;
  const observaciones = String(cabecera?.observaciones ?? '').trim();
  if (observaciones) {
    let oy = yFin + 6;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 41, 59);
    doc.text('OBSERVACIONES', 14, oy);
    oy += 4.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    const obsLines = doc.splitTextToSize(observaciones, 182);
    doc.text(obsLines, 14, oy);
    yFin = oy + obsLines.length * 3.4;
  }

  pieFirmas(doc, cabecera, yFin + 10);
  if (typeof doc.putTotalPages === 'function') {
    doc.putTotalPages(TOTAL_PAGES_EXP);
  }
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
      return pdfLineas(cabecera, contenido, tipo);
    case 'TRABAJO_AVANCE':
      return pdfTrabajoAvance(cabecera, contenido);
    case 'CONTEO_RAPIDO':
      return pdfConteoRapido(cabecera, contenido);
    default:
      return pdfLineas(cabecera, contenido);
  }
}

// ─── Excel detalle individual ─────────────────────────────────────────────────
export function exportReporteDetalleExcel(cabecera, contenido, tipo) {
  if (!cabecera) throw new Error('Sin datos de cabecera del reporte');

  const libro = XLSX.utils.book_new();

  // ── Hojas de contenido según tipo ──
  if (tipo === 'APOYO_HORAS' || tipo === 'SANEAMIENTO') {
    const lineas = contenido?.items ?? [];
    const esSaneamiento = tipo === 'SANEAMIENTO';

    if (esSaneamiento) {
      const head = ['ITEM', 'CÓDIGO', 'NOMBRE', 'COD. ACTIVIDAD', 'ACTIVIDAD', 'CVSE'];
      console.log(lineas);
      const rows = lineas.map((l, i) => [
        i + 1,
        l.trabajador_codigo ?? '',
        '',
        '',
        '',
        Number(l.horas) || 0,
      ]);

      const hoja = XLSX.utils.aoa_to_sheet([
       
        head,
        ...rows,
      ]);

      hoja['!cols'] = [8, 14, 38, 16, 18, 10].map(wch => ({ wch }));
      hoja['!autofilter'] = { ref: `A1:F${rows.length + 1}` };

      for (let r = 2; r <= rows.length + 1; r++) {
        const cell = hoja[`F${r}`];
        if (cell) cell.z = '0.00';
      }

      const obsSan = String(cabecera?.observaciones ?? '').trim();
      if (obsSan) {
        XLSX.utils.sheet_add_aoa(hoja, [[], ['OBSERVACIONES:', obsSan]], { origin: -1 });
      }

      XLSX.utils.book_append_sheet(libro, hoja, 'Saneamiento');
      XLSX.writeFile(libro, `trabunda-reporte-${cabecera.id}-saneamiento.xlsx`);
      return;
    }

    const ultimaCol = esSaneamiento ? 'Labores Realizadas' : 'Área';
    const head = ['N°', 'Código', 'Apellidos y Nombres', 'H. Inicio', 'H. Fin', 'Total Hrs', ultimaCol];
    const rows = lineas.map((l, i) => [
      i + 1,
      l.trabajador_codigo ?? '—',
      l.trabajador_nombre ?? '—',
      fmtHora(l.hora_inicio),
      fmtHora(l.hora_fin),
      l.horas != null ? Number(l.horas).toFixed(1) : '0.0',
      esSaneamiento
        ? (l.labores ?? '—')
        : (l.area_nombre ?? l.cuadrilla_nombre ?? '—'),
    ]);
    // Fila de totales
    const totalHrs = lineas.reduce((s, l) => s + (Number(l.horas) || 0), 0);
    rows.push(['', '', `TOTAL: ${lineas.length} trabajadores`, '', '', totalHrs.toFixed(1), '']);

    // Observaciones del reporte (si las hay)
    const obsApoyo = String(cabecera?.observaciones ?? '').trim();
    if (obsApoyo) {
      rows.push(['', '', '', '', '', '', '']);
      rows.push(['OBSERVACIONES:', obsApoyo, '', '', '', '', '']);
    }

    const hoja = XLSX.utils.aoa_to_sheet([head, ...rows]);
    hoja['!cols'] = [6, 12, 36, 10, 10, 12, 28].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(libro, hoja, TIPO_LABELS[tipo] ?? tipo);
  }

  else if (tipo === 'TRABAJO_AVANCE') {
    // Hoja Recepción
    if (contenido?.recepcion?.length) {
      const head = ['Nombre', 'H. Inicio', 'H. Fin', 'KG'];
      const rows = contenido.recepcion.map(r => [r.nombre ?? '—', fmtHora(r.hora_inicio), fmtHora(r.hora_fin), r.kg ?? 0]);
      const hoja = XLSX.utils.aoa_to_sheet([head, ...rows]);
      hoja['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(libro, hoja, 'Recepción');
    }
    // Hoja Fileteado
    if (contenido?.fileteado?.lista?.length) {
      const head = ['Nombre', 'H. Inicio', 'H. Fin', 'KG'];
      const rows = contenido.fileteado.lista.map(r => [r.nombre ?? '—', fmtHora(r.hora_inicio), fmtHora(r.hora_fin), r.kg ?? 0]);
      rows.push(['TOTAL KG', '', '', contenido.fileteado.totalKg ?? 0]);
      const hoja = XLSX.utils.aoa_to_sheet([head, ...rows]);
      hoja['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(libro, hoja, 'Fileteado');
    }
    // Hoja Totales
    if (contenido?.totales) {
      const t = contenido.totales;
      const hoja = XLSX.utils.aoa_to_sheet([
        ['Concepto', 'KG'],
        ['Recepción', t.RECEPCION ?? 0],
        ['Fileteado', t.FILETEADO ?? 0],
        ['Apoyo Recepción', t.APOYO_RECEPCION ?? 0],
      ]);
      hoja['!cols'] = [{ wch: 20 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(libro, hoja, 'Totales');
    }
  }

  else if (tipo === 'CONTEO_RAPIDO') {
    const cab  = contenido?.reporte ?? cabecera;
    const items = contenido?.items ?? [];
    const total = items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
    const head = ['Área', 'Cantidad'];
    const rows = items.map(i => [i.area_nombre ?? '—', i.cantidad ?? 0]);
    rows.push(['TOTAL', total]);
    const hoja = XLSX.utils.aoa_to_sheet([head, ...rows]);
    hoja['!cols'] = [{ wch: 30 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(libro, hoja, 'Conteo Rápido');
    void cab;
  }

  const nombreTipo = (TIPO_LABELS[tipo] ?? tipo ?? 'reporte').toLowerCase().replace(/ /g, '-');
  XLSX.writeFile(libro, `trabunda-reporte-${cabecera.id}-${nombreTipo}.xlsx`);
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

// ═════════════════════════════════════════════════════════════════════════════
//  RUTAS — Exportación de jornadas y control de movilidad
// ═════════════════════════════════════════════════════════════════════════════

const ESTADO_RUTAS_LABELS = {
  ABIERTA:    'Abierta',
  EN_PROCESO: 'En Proceso',
  FINALIZADA: 'Finalizada',
};

function fmtFechaRutas(val) {
  if (!val) return '—';
  try {
    const [y, m, d] = String(val).split('-');
    return `${d}/${m}/${y}`;
  } catch { return String(val); }
}

function fmtHoraISO(val) {
  if (!val) return '—';
  try { return new Date(val).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

// ─── PDF: lista de jornadas ───────────────────────────────────────────────────
export function exportRutasJornadasPDF(jornadas, fecha) {
  if (!jornadas.length) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Rutas Trabunda — Control de Movilidad', 14, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Fecha: ${fecha}  ·  Total jornadas: ${jornadas.length}`, 14, 20);
  doc.text(
    `Generado: ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`,
    283, 20, { align: 'right' }
  );

  autoTable(doc, {
    head: [['ID', 'Fecha', 'Turno', 'Ruta', 'Placa', 'Estado', 'Marcados', 'Sesiones']],
    body: jornadas.map(j => [
      j.id_jornada,
      fmtFecha(j.fecha),
      getTurnoNombre(j),
      getRutaNombre(j),
      j.placa    ?? '—',
      ESTADO_RUTAS_LABELS[j.estado_actual] ?? j.estado_actual ?? '—',
      j.total_marcados        ?? 0,
      j.sesiones_involucradas ?? 0,
    ]),
    startY: 26,
    margin: { left: 14, right: 14 },
    styles:     { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 30, halign: 'center', font: 'courier' },
      5: { cellWidth: 30 },
      6: { cellWidth: 24, halign: 'center' },
      7: { cellWidth: 24, halign: 'center' },
    },
  });

  const totalPags = doc.getNumberOfPages();
  for (let i = 1; i <= totalPags; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Página ${i} de ${totalPags}`, 148.5, 205, { align: 'center' });
  }
  doc.save(`rutas-jornadas-${fecha}.pdf`);
}

// ─── Excel: lista de jornadas ─────────────────────────────────────────────────
export function exportRutasJornadasExcel(jornadas, fecha) {
  if (!jornadas.length) return;

  const cabecera = ['ID Jornada', 'Fecha', 'Turno', 'Ruta', 'Placa', 'Estado', 'Estado Real', 'Marcados', 'Sesiones', 'Creado En'];
  const filas = jornadas.map(j => [
    j.id_jornada,
    fmtFecha(j.fecha),
    getTurnoNombre(j),
    getRutaNombre(j),
    j.placa    ?? '—',
    ESTADO_RUTAS_LABELS[j.estado_actual] ?? j.estado_actual ?? '—',
    j.estado_real ?? '—',
    j.total_marcados        ?? 0,
    j.sesiones_involucradas ?? 0,
    j.creado_en ? new Date(j.creado_en).toLocaleString('es-ES') : '—',
  ]);

  const hoja = XLSX.utils.aoa_to_sheet([cabecera, ...filas]);
  hoja['!cols'] = [12, 14, 12, 10, 16, 14, 14, 12, 12, 22].map(wch => ({ wch }));

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Jornadas');
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([
    ['Proyecto',        'Rutas Trabunda'],
    ['Fecha filtro',    fecha],
    ['Total jornadas',  jornadas.length],
    ['Generado',        new Date().toLocaleString('es-ES')],
  ]), 'Info');

  XLSX.writeFile(libro, `rutas-jornadas-${fecha}.xlsx`);
}

// ─── PDF: detalle de una jornada (Control de Movilidad) ──────────────────────
export function exportRutasJornadaDetallePDF(jornada, resumenData, trabajadores) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const hoyStr = fmtFecha(new Date().toISOString());

  // Encabezado institucional
  autoTable(doc, {
    body: [[
      { content: 'RUTAS TRABUNDA', styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 10 } },
      { content: 'FORMATO\nCONTROL DE MOVILIDAD', styles: { fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 8 } },
      { content: `Código: COD-RM-01\nVersión: 01\nFecha: ${hoyStr}`, styles: { halign: 'left', valign: 'middle', fontSize: 7 } },
    ]],
    startY: 12,
    margin: { left: 14, right: 14 },
    styles: { lineColor: [100, 116, 139], lineWidth: 0.3, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 50 } },
    theme: 'grid',
  });

  // Info de la jornada
  const estadoLabel = ESTADO_RUTAS_LABELS[jornada?.estado_actual] ?? jornada?.estado_actual ?? '—';
  autoTable(doc, {
    body: [
      [
        { content: `Fecha: ${fmtFechaRutas(jornada?.fecha)}`, styles: { fontSize: 8 } },
        { content: `Turno: ${getTurnoNombre(jornada)}`, styles: { fontSize: 8 } },
        { content: `Ruta: ${getRutaNombre(jornada)}`, styles: { fontSize: 8 } },
      ],
      [
        { content: `Placa: ${jornada?.placa ?? '—'}`, styles: { fontSize: 8, fontStyle: 'bold' } },
        { content: `Estado: ${estadoLabel}`, styles: { fontSize: 8 } },
        { content: `Jornada ID: #${jornada?.id_jornada ?? '—'}`, styles: { fontSize: 8 } },
      ],
    ],
    startY: doc.lastAutoTable.finalY,
    margin: { left: 14, right: 14 },
    styles: { lineColor: [100, 116, 139], lineWidth: 0.3, cellPadding: 2 },
    theme: 'grid',
  });

  // Stats de resumen
  if (resumenData) {
    autoTable(doc, {
      body: [[
        { content: `Marcados\n${resumenData.total_marcados ?? 0}`,       styles: { fontStyle: 'bold', fontSize: 10, halign: 'center', fillColor: [236, 253, 245] } },
        { content: `Asignados\n${resumenData.total_asignados ?? 0}`,     styles: { fontStyle: 'bold', fontSize: 10, halign: 'center', fillColor: [239, 246, 255] } },
        { content: `Faltantes\n${resumenData.faltantes ?? 0}`,           styles: { fontStyle: 'bold', fontSize: 10, halign: 'center', fillColor: [255, 241, 242] } },
        { content: `Sesiones\n${resumenData.sesiones_involucradas ?? 0}`, styles: { fontStyle: 'bold', fontSize: 10, halign: 'center', fillColor: [250, 245, 255] } },
      ]],
      startY: doc.lastAutoTable.finalY,
      margin: { left: 14, right: 14 },
      styles: { lineColor: [100, 116, 139], lineWidth: 0.3, cellPadding: 4 },
      theme: 'grid',
    });
  }

  // Tabla de trabajadores
  autoTable(doc, {
    head: [['N°', 'DNI', 'Apellidos y Nombres', 'Cargo', 'Hora', 'Origen']],
    body: (trabajadores ?? []).map((t, i) => [
      i + 1,
      t.dni ?? '—',
      `${(t.apellidos ?? '').toUpperCase()} ${t.nombres ?? ''}`.trim() || '—',
      t.cargo ?? '—',
      fmtHoraISO(t.fecha_hora),
      t.origen ?? '—',
    ]),
    startY: doc.lastAutoTable.finalY + 4,
    margin: { left: 14, right: 14 },
    styles:     { fontSize: 8, cellPadding: 2, lineColor: [100, 116, 139], lineWidth: 0.2 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 8,  halign: 'center' },
      1: { cellWidth: 24, halign: 'center' },
      2: { cellWidth: 72 },
      3: { cellWidth: 30 },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 28 },
    },
    theme: 'grid',
  });

  // Pie
  let y = (doc.lastAutoTable?.finalY ?? 250) + 10;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`Total trabajadores marcados: ${trabajadores?.length ?? 0}  ·  Generado: ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`, 14, y);

  doc.save(`rutas-jornada-${jornada?.id_jornada ?? 'x'}-${jornada?.fecha ?? 'sin-fecha'}.pdf`);
}

// ─── Excel: detalle de una jornada ───────────────────────────────────────────
export function exportRutasJornadaDetalleExcel(jornada, resumenData, trabajadores) {
  const libro = XLSX.utils.book_new();

  // Hoja resumen
  const hojaResumen = XLSX.utils.aoa_to_sheet([
    ['Campo',        'Valor'],
    ['ID Jornada',   jornada?.id_jornada ?? '—'],
    ['Fecha',        fmtFechaRutas(jornada?.fecha)],
    ['Turno',        getTurnoNombre(jornada)],
    ['Ruta',         getRutaNombre(jornada)],
    ['Placa',        jornada?.placa    ?? '—'],
    ['Estado',       ESTADO_RUTAS_LABELS[jornada?.estado_actual] ?? jornada?.estado_actual ?? '—'],
    ['', ''],
    ['Marcados',     resumenData?.total_marcados        ?? 0],
    ['Asignados',    resumenData?.total_asignados       ?? 0],
    ['Faltantes',    resumenData?.faltantes             ?? 0],
    ['Sesiones',     resumenData?.sesiones_involucradas ?? 0],
    ['', ''],
    ['Generado',     new Date().toLocaleString('es-ES')],
  ]);
  hojaResumen['!cols'] = [{ wch: 18 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');

  // Hoja trabajadores
  const cab  = ['N°', 'DNI', 'Nombres', 'Apellidos', 'Cargo', 'Hora de Abordaje', 'Dispositivo', 'Origen'];
  const filas = (trabajadores ?? []).map((t, i) => [
    i + 1,
    t.dni          ?? '—',
    t.nombres      ?? '—',
    t.apellidos    ?? '—',
    t.cargo        ?? '—',
    t.fecha_hora ? new Date(t.fecha_hora).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '—',
    t.dispositivo_id ?? '—',
    t.origen         ?? '—',
  ]);
  const hojaTrab = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  hojaTrab['!cols'] = [6, 14, 24, 24, 22, 18, 20, 16].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(libro, hojaTrab, 'Trabajadores');

  XLSX.writeFile(libro, `rutas-jornada-${jornada?.id_jornada ?? 'x'}-${jornada?.fecha ?? 'sin-fecha'}.xlsx`);
}

// ─── Excel: directorio de trabajadores (con área y ruta) ─────────────────────
export function exportRutasTrabajadoresExcel(trabajadores, meta = {}) {
  const libro = XLSX.utils.book_new();

  const cab = ['N°', 'DNI', 'Apellidos', 'Nombres', 'Cargo', 'Cód. Área', 'Área', 'Cód. Ruta', 'Ruta', 'Hora Scan'];
  const filas = (trabajadores ?? []).map((t, i) => [
    i + 1,
    t.dni          ?? '—',
    t.apellidos    ?? '—',
    t.nombres      ?? '—',
    t.cargo        ?? '—',
    t.area_codigo  ?? '—',
    t.area_nombre  ?? '—',
    t.ruta_codigo  ?? '',
    t.ruta_nombre  ?? 'Sin ruta',
    t.hora_scan    ?? '—',
  ]);
  const hoja = XLSX.utils.aoa_to_sheet([cab, ...filas]);
  hoja['!cols'] = [5, 12, 24, 20, 26, 10, 22, 10, 22, 12].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(libro, hoja, 'Trabajadores');

  // Hoja info — qué filtros se aplicaron
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([
    ['Proyecto',  'Rutas Trabunda'],
    ['Scans',     meta.soloHoy ? 'Solo de hoy' : 'Histórico'],
    ['Área',      meta.areaLabel  ?? 'Todas'],
    ['Ruta',      meta.rutaLabel  ?? 'Todas'],
    ['Solo con ruta', meta.conRuta ? 'Sí' : 'No'],
    ['Total',     (trabajadores ?? []).length],
    ['Generado',  new Date().toLocaleString('es-ES')],
  ]), 'Info');

  XLSX.writeFile(libro, `rutas-trabajadores-${new Date().toISOString().split('T')[0]}.xlsx`);
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
