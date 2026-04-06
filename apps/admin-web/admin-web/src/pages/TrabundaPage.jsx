import { useState, useEffect } from 'react';
import {
  RefreshCw, Clock, Users, FileText, CheckCircle, XCircle,
  AlertCircle, Database, Search, ChevronLeft, ChevronRight,
  Download, Plus, Eye, EyeOff, Shield, UserPlus, Copy, Check,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  apiGetTrabundaDashboard, apiGetTrabundaReportes, apiGetTrabundaReporteDetalle,
  apiCrearUsuarioTrabunda,
} from '../api/gateway';
import { exportToPDF, exportToExcel, exportReporteDetallePDF, exportReporteDetalleExcel } from '../utils/exportUtils';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MODULOS = [
  { tipo: 'APOYO_HORAS',    label: 'Apoyo Horas',    descripcion: 'Registro de horas trabajadas por operario con hora inicio y fin.', color: 'blue',    icon: <Clock size={22} />        },
  { tipo: 'SANEAMIENTO',    label: 'Saneamiento',    descripcion: 'Reportes de limpieza e higiene por área y turno.',                  color: 'emerald', icon: <CheckCircle size={22} />  },
  { tipo: 'TRABAJO_AVANCE', label: 'Trabajo Avance', descripcion: 'Cuadrillas de recepción/fileteado con producción en kg.',           color: 'violet',  icon: <Users size={22} />        },
  { tipo: 'CONTEO_RAPIDO',  label: 'Conteo Rápido',  descripcion: 'Conteo de personal por área en tiempo real.',                       color: 'amber',   icon: <FileText size={22} />     },
];

const TIPO_LABELS = {
  APOYO_HORAS:    { label: 'Apoyo Horas',    color: 'blue'    },
  SANEAMIENTO:    { label: 'Saneamiento',    color: 'emerald' },
  TRABAJO_AVANCE: { label: 'Trabajo Avance', color: 'violet'  },
  CONTEO_RAPIDO:  { label: 'Conteo Rápido',  color: 'amber'   },
};

const colorMap = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    badge: 'bg-blue-100 text-blue-700'       },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', badge: 'bg-emerald-100 text-emerald-700' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  badge: 'bg-violet-100 text-violet-700'   },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   badge: 'bg-amber-100 text-amber-700'     },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-600',   badge: 'bg-slate-100 text-slate-600'     },
};

function hoy() {
  return new Date().toISOString().split('T')[0];
}

// ─── Componentes reutilizables ────────────────────────────────────────────────

function StatusBadge({ ok, label }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
      ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
      {ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
      {label}
    </div>
  );
}

function TipoBadge({ tipo }) {
  const info  = TIPO_LABELS[tipo];
  const color = info ? colorMap[info.color] : colorMap.slate;
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color.badge}`}>
      {info?.label ?? tipo ?? '—'}
    </span>
  );
}

function NotConfigured() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center max-w-lg mx-auto mt-10">
      <AlertCircle size={40} className="text-amber-500 mx-auto mb-4" />
      <h3 className="font-bold text-slate-800 text-lg mb-2">Backend no configurado</h3>
      <p className="text-slate-500 text-sm leading-relaxed mb-4">
        Configura las variables de entorno en <code className="bg-amber-100 px-1 rounded">.env</code>:
      </p>
      <pre className="text-left bg-slate-900 text-emerald-400 text-xs rounded-xl p-4 overflow-x-auto">
{`TRABUNDA_BACKEND_URL=http://tu-servidor:puerto
TRABUNDA_ADMIN_USER=admin
TRABUNDA_ADMIN_PASS=tu_password`}
      </pre>
    </div>
  );
}

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────

function TabResumen({ data, loading }) {
  const apiOnline      = data?.health != null;
  const workersOnline  = data?.healthWorkers != null;
  const areasActivas   = (data?.areas?.areas ?? data?.areas?.data ?? []).filter(a => a.activo !== 0).length;
  const totalAreas     = (data?.areas?.areas ?? data?.areas?.data ?? []).length;
  const totalReportes  = data?.reportesHoy?.total ?? 0;
  const reportesPorTipo = data?.reportesHoy?.porTipo ?? {};
  const totalUsuarios  = (data?.usuarios?.users ?? data?.usuarios?.data ?? []).length;

  if (loading && !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data?.configured) return null;

  return (
    <div className="space-y-8">
      {/* Estado del sistema */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Estado del sistema</h2>
        <div className="flex flex-wrap gap-3">
          <StatusBadge ok={apiOnline}     label="API Backend" />
          <StatusBadge ok={workersOnline} label="Servicio Workers (GraphQL)" />
          <StatusBadge ok={!!data?.areas} label="Base de datos" />
        </div>
      </div>

      {/* Stats del día */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Reportes hoy',   value: totalReportes, color: 'blue',    sub: 'todos los tipos'              },
          { label: 'Áreas activas',  value: areasActivas,  color: 'emerald', sub: `de ${totalAreas} totales`     },
          { label: 'Usuarios',       value: totalUsuarios, color: 'violet',  sub: 'planilleros y admin'          },
          { label: 'Pendientes',
            value: (reportesPorTipo['APOYO_HORAS'] || 0) + (reportesPorTipo['SANEAMIENTO'] || 0),
            color: 'amber', sub: 'apoyo horas + saneamiento' },
        ].map(({ label, value, color, sub }) => {
          const c = colorMap[color];
          return (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
              <p className={`text-3xl font-bold ${c.text}`}>{value ?? '—'}</p>
              {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
            </div>
          );
        })}
      </div>

      {/* Módulos operativos */}
      <div>
        <h2 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Módulos operativos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {MODULOS.map(m => {
            const c = colorMap[m.color];
            return (
              <div key={m.tipo} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-xl ${c.bg} ${c.text}`}>{m.icon}</div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.badge}`}>
                    {reportesPorTipo[m.tipo] ?? 0} hoy
                  </span>
                </div>
                <h3 className="font-bold text-slate-800 mb-1">{m.label}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{m.descripcion}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Áreas */}
      {data?.areas && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="font-bold text-slate-700">Áreas configuradas</h2>
            <p className="text-sm text-slate-400">Catálogo transversal de áreas por módulo</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  {['Área', 'Apoyo Horas', 'Conteo Rápido', 'Trab. Avance', 'Estado'].map(h => (
                    <th key={h} className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data.areas?.areas ?? data.areas?.data ?? []).slice(0, 15).map((area, i) => (
                  <tr key={area.id ?? i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-800">{area.nombre}</td>
                    <td className="px-6 py-3">{area.es_apoyo_horas    ? <span className="text-emerald-500">✓</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-6 py-3">{area.es_conteo_rapido  ? <span className="text-emerald-500">✓</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-6 py-3">{area.es_trabajo_avance ? <span className="text-emerald-500">✓</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="px-6 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${area.activo !== 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {area.activo !== 0 ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stack técnico */}
      <div className="bg-slate-900 rounded-2xl p-6 text-slate-400 text-sm">
        <div className="flex items-center gap-2 mb-3">
          <Database size={16} className="text-slate-500" />
          <span className="font-bold text-white text-xs uppercase tracking-wider">Stack técnico</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div><span className="text-slate-500">Mobile</span><p className="text-white font-medium mt-0.5">Flutter (Android/iOS)</p></div>
          <div><span className="text-slate-500">Backend</span><p className="text-white font-medium mt-0.5">Node.js + Express</p></div>
          <div><span className="text-slate-500">Base de datos</span><p className="text-white font-medium mt-0.5">MySQL (Docker)</p></div>
          <div><span className="text-slate-500">Workers</span><p className="text-white font-medium mt-0.5">GraphQL externo</p></div>
        </div>
      </div>
    </div>
  );
}

// ─── Columnas conocidas del backend de Trabunda ───────────────────────────────
// Definimos qué columnas mostrar y con qué etiqueta.
// El orden aquí es el orden en la tabla.
const COLUMNAS = [
  { key: 'id',                label: 'ID',         width: 'w-16'   },
  { key: 'fecha',             label: 'Fecha',       width: 'w-28'   },
  { key: 'turno',             label: 'Turno',       width: 'w-20'   },
  { key: 'tipo_reporte',      label: 'Tipo',        width: 'w-36'   },
  { key: 'area_nombre',       label: 'Área',        width: 'w-40'   },
  { key: 'creado_por_nombre', label: 'Creador',     width: 'w-40'   },
  { key: 'estado',            label: 'Estado',      width: 'w-24'   },
  { key: 'observaciones',     label: 'Observaciones', width: 'w-52' },
  { key: 'creado_en',         label: 'Creado',      width: 'w-36'   },
];

const ESTADO_COLORS = {
  ABIERTO:   'bg-blue-100 text-blue-700',
  CERRADO:   'bg-slate-100 text-slate-600',
  PENDIENTE: 'bg-amber-100 text-amber-700',
  APROBADO:  'bg-emerald-100 text-emerald-700',
  RECHAZADO: 'bg-red-100 text-red-600',
};

function EstadoBadge({ estado }) {
  if (!estado) return <span className="text-slate-300">—</span>;
  const cls = ESTADO_COLORS[estado?.toUpperCase()] ?? 'bg-slate-100 text-slate-600';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{estado}</span>;
}

function fmtFecha(val) {
  if (!val) return '—';
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))
    return new Date(val).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val))
    return new Date(val + 'T00:00:00').toLocaleDateString('es-ES');
  return String(val);
}

// ─── Tab: Reportes ────────────────────────────────────────────────────────────

function TabReportes() {
  const [fecha,   setFecha]   = useState(hoy());
  const [tipo,    setTipo]    = useState('');
  const [turno,   setTurno]   = useState('');
  const [q,       setQ]       = useState('');
  const [reportes, setReportes] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pagina,   setPagina]   = useState(1);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  // ID del reporte descargando (null = ninguno)
  const [descargando,      setDescargando]      = useState(null); // PDF
  const [descargandoExcel, setDescargandoExcel] = useState(null); // Excel

  async function cargar({ f = fecha, t = tipo, tu = turno, search = q, p = 1 } = {}) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetTrabundaReportes({ fecha: f, tipo: t, turno: tu, q: search, page: p, limit: 25 });
      setReportes(data?.reportes ?? []);
      setTotal(data?.total ?? 0);
      setTotalPages(data?.totalPages ?? 1);
      setPagina(data?.page ?? p);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiltrar(e) {
    e.preventDefault();
    cargar({ f: fecha, t: tipo, tu: turno, search: q, p: 1 });
  }

  function renderCelda(reporte, col) {
    const val = reporte[col.key];
    if (col.key === 'tipo_reporte') return <TipoBadge tipo={val} />;
    if (col.key === 'estado')       return <EstadoBadge estado={val} />;
    if (col.key === 'fecha' || col.key === 'creado_en') return <span className="text-slate-600">{fmtFecha(val)}</span>;
    if (col.key === 'observaciones') return <span className="text-slate-500 text-xs truncate block max-w-[200px]" title={val ?? ''}>{val || '—'}</span>;
    if (col.key === 'turno') {
      if (!val) return <span className="text-slate-300">—</span>;
      return <span className="text-xs font-semibold text-slate-600 uppercase">{val}</span>;
    }
    if (val === null || val === undefined) return <span className="text-slate-300">—</span>;
    return <span>{String(val)}</span>;
  }

  return (
    <div className="space-y-5">

      {/* ── Filtros ──────────────────────────────────────────────── */}
      <form onSubmit={handleFiltrar} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Fecha */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>

          {/* Tipo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white">
              <option value="">Todos</option>
              {MODULOS.map(m => <option key={m.tipo} value={m.tipo}>{m.label}</option>)}
            </select>
          </div>

          {/* Turno */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Turno</label>
            <select value={turno} onChange={e => setTurno(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white">
              <option value="">Todos</option>
              <option value="MAÑANA">Mañana</option>
              <option value="TARDE">Tarde</option>
              <option value="NOCHE">Noche</option>
            </select>
          </div>

          {/* Búsqueda libre (se envía al servidor como &q=) */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Buscar</label>
            <input type="text" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Área, nombre, observaciones..."
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </div>

          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all">
            <Search size={14} /> Buscar
          </button>
        </div>
      </form>

      {/* ── Error ────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
          <XCircle size={20} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* ── Tabla ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              {loading ? 'Cargando...' : `${total} reporte${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
            </p>
            <p className="text-xs text-slate-400">
              {fecha}{tipo ? ` · ${TIPO_LABELS[tipo]?.label ?? tipo}` : ''}{turno ? ` · Turno ${turno}` : ''}
            </p>
          </div>

          {!loading && reportes.length > 0 && (
            <div className="flex gap-2">
              <button onClick={() => exportToExcel(reportes, fecha, tipo)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-all">
                <Download size={12} /> Excel
              </button>
              <button onClick={() => exportToPDF(reportes, fecha, tipo)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-all">
                <Download size={12} /> PDF
              </button>
            </div>
          )}
        </div>

        {/* Skeleton */}
        {loading && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Sin resultados */}
        {!loading && reportes.length === 0 && (
          <div className="p-12 text-center">
            <FileText size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-500">Sin reportes para esta búsqueda</p>
            <p className="text-sm text-slate-400 mt-1">Prueba otra fecha, tipo o turno</p>
          </div>
        )}

        {/* Tabla con columnas fijas */}
        {!loading && reportes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {COLUMNAS.map(col => (
                    <th key={col.key} className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Descargar
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportes.map((reporte, i) => (
                  <tr key={reporte.id ?? i} className="hover:bg-slate-50 transition-colors">
                    {COLUMNAS.map(col => (
                      <td key={col.key} className="px-4 py-3 text-slate-700">
                        {renderCelda(reporte, col)}
                      </td>
                    ))}
                    {/* Botones de descarga individual */}
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        {/* Excel */}
                        <button
                          disabled={descargandoExcel === reporte.id}
                          onClick={async () => {
                            setDescargandoExcel(reporte.id);
                            try {
                              const detalle = await apiGetTrabundaReporteDetalle(reporte.id);
                              exportReporteDetalleExcel(detalle.cabecera, detalle.contenido, detalle.tipo);
                            } catch (err) {
                              console.error('Error generando Excel:', err);
                              alert('Error: ' + (err?.message ?? 'No se pudo generar el Excel'));
                            } finally {
                              setDescargandoExcel(null);
                            }
                          }}
                          title={`Descargar Excel #${reporte.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg transition-all disabled:opacity-50"
                        >
                          {descargandoExcel === reporte.id
                            ? <RefreshCw size={11} className="animate-spin" />
                            : <Download size={11} />
                          }
                          XLS
                        </button>
                        {/* PDF */}
                        <button
                          disabled={descargando === reporte.id}
                          onClick={async () => {
                            setDescargando(reporte.id);
                            try {
                              const detalle = await apiGetTrabundaReporteDetalle(reporte.id);
                              exportReporteDetallePDF(detalle.cabecera, detalle.contenido, detalle.tipo);
                            } catch (err) {
                              console.error('Error generando PDF:', err);
                              alert('Error: ' + (err?.message ?? 'No se pudo generar el PDF'));
                            } finally {
                              setDescargando(null);
                            }
                          }}
                          title={`Descargar PDF #${reporte.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-all disabled:opacity-50"
                        >
                          {descargando === reporte.id
                            ? <RefreshCw size={11} className="animate-spin" />
                            : <Download size={11} />
                          }
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => cargar({ p: pagina - 1 })}
              disabled={pagina <= 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all"
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <span className="text-sm text-slate-500">Página {pagina} de {totalPages} · {total} registros</span>
            <button
              onClick={() => cargar({ p: pagina + 1 })}
              disabled={pagina >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all"
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal: Crear usuario Trabunda ────────────────────────────────────────────

const ROL_INFO = {
  ADMIN: {
    label: 'Administrador',
    descripcion: 'Puede crear y gestionar todos los reportes del sistema Trabunda.',
    color: 'violet',
  },
  SCANNER: {
    label: 'Scanner',
    descripcion: 'Acceso al módulo de escaneo y operaciones de campo.',
    color: 'blue',
  },
};

function ModalCrearUsuario({ onClose, onCreated }) {
  const [form, setForm]         = useState({ username: '', nombre: '', password: '', rol: 'ADMIN' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) {
      setError('Usuario y contraseña son obligatorios');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await apiCrearUsuarioTrabunda({
        username: form.username.trim().toLowerCase(),
        nombre:   form.nombre.trim() || undefined,
        password: form.password,
        rol:      form.rol,
      });
      if (res?.ok === false) throw new Error(res.error ?? res.message ?? 'Error al crear el usuario');
      onCreated({ username: form.username.trim().toLowerCase(), nombre: form.nombre.trim(), rol: form.rol });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const rolInfo = ROL_INFO[form.rol];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <UserPlus size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Nuevo usuario Trabunda</h2>
              <p className="text-xs text-slate-400 mt-0.5">Se creará en el backend de Trabunda</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-all">
            <XCircle size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <AlertCircle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Rol */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-2 block uppercase tracking-wide">Rol <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(ROL_INFO).map(([key, info]) => (
                <button key={key} type="button"
                  onClick={() => setForm(p => ({ ...p, rol: key }))}
                  className={`p-3 rounded-xl border-2 text-left transition-all
                    ${form.rol === key
                      ? key === 'ADMIN' ? 'border-violet-500 bg-violet-50' : 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}>
                  <p className={`text-xs font-bold ${form.rol === key ? (key === 'ADMIN' ? 'text-violet-700' : 'text-blue-700') : 'text-slate-600'}`}>
                    {info.label}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{info.descripcion}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wide">
              Usuario <span className="text-red-400">*</span>
            </label>
            <input type="text" value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
              placeholder="Ej: planillero01"
              maxLength={50} autoComplete="off"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
            <p className="text-[11px] text-slate-400 mt-1">Solo letras, números y guiones bajos. Sin espacios.</p>
          </div>

          {/* Nombre */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wide">
              Nombre completo <span className="text-slate-300">(opcional)</span>
            </label>
            <input type="text" value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Juan García"
              maxLength={100}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Contraseña */}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wide">
              Contraseña <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                minLength={6} maxLength={100} autoComplete="new-password"
                className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50">
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {loading ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tarjeta de usuario creado ────────────────────────────────────────────────

function UsuarioCreatedCard({ user, onDismiss }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(user.username).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const info = ROL_INFO[user.rol] ?? { label: user.rol, color: 'slate' };
  const colors = {
    violet: { bg: 'bg-violet-50', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700', icon: 'text-violet-500' },
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700',     icon: 'text-blue-500'   },
    slate:  { bg: 'bg-slate-50',  border: 'border-slate-200',  badge: 'bg-slate-100 text-slate-600',   icon: 'text-slate-400'  },
  };
  const c = colors[info.color] ?? colors.slate;

  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-5 flex items-start gap-4`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${c.bg}`}>
        <CheckCircle size={20} className={c.icon} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800">Usuario creado correctamente</p>
        <div className="flex items-center gap-2 mt-1">
          <code className="text-sm font-mono text-slate-700 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
            {user.username}
          </code>
          <button onClick={handleCopy} className="text-slate-400 hover:text-slate-600 transition-colors" title="Copiar usuario">
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>{info.label}</span>
        </div>
        {user.nombre && <p className="text-xs text-slate-500 mt-1">{user.nombre}</p>}
      </div>
      <button onClick={onDismiss} className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0">
        <XCircle size={16} />
      </button>
    </div>
  );
}

// ─── Tab: Usuarios (solo superadmin) ─────────────────────────────────────────

function TabUsuarios({ data }) {
  const [showModal,     setShowModal]     = useState(false);
  const [createdUsers,  setCreatedUsers]  = useState([]);

  const usuariosExistentes = data?.usuarios?.users ?? data?.usuarios?.data ?? [];

  function handleCreated(user) {
    setShowModal(false);
    setCreatedUsers(prev => [user, ...prev]);
  }

  return (
    <div className="space-y-6">
      {/* Header zona admin */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Shield size={18} className="text-blue-600" />
        </div>
        <div>
          <p className="font-bold text-blue-800 text-sm">Gestión de Usuarios — Trabunda</p>
          <p className="text-xs text-blue-500 mt-0.5">Los usuarios creados aquí acceden directamente a la app Trabunda (no al AdminSuite)</p>
        </div>
      </div>

      {/* Roles disponibles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(ROL_INFO).map(([key, info]) => {
          const isViolet = info.color === 'violet';
          return (
            <div key={key} className={`rounded-2xl border p-5 ${isViolet ? 'bg-violet-50 border-violet-200' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isViolet ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                  {key}
                </span>
                <span className={`font-bold text-sm ${isViolet ? 'text-violet-800' : 'text-blue-800'}`}>{info.label}</span>
              </div>
              <p className={`text-xs leading-relaxed ${isViolet ? 'text-violet-600' : 'text-blue-600'}`}>{info.descripcion}</p>
            </div>
          );
        })}
      </div>

      {/* Usuarios recién creados en esta sesión */}
      {createdUsers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Creados en esta sesión</h3>
          {createdUsers.map((u, i) => (
            <UsuarioCreatedCard key={i} user={u} onDismiss={() => setCreatedUsers(prev => prev.filter((_, idx) => idx !== i))} />
          ))}
        </div>
      )}

      {/* Botón crear */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800">Usuarios del sistema Trabunda</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {usuariosExistentes.length > 0
                ? `${usuariosExistentes.length} usuario${usuariosExistentes.length !== 1 ? 's' : ''} activos (planilleros y admins)`
                : 'Sin usuarios registrados aún'}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm shadow-blue-200"
          >
            <Plus size={14} /> Nuevo usuario
          </button>
        </div>

        {usuariosExistentes.length === 0 ? (
          <div className="text-center py-10 text-slate-400 border border-dashed border-slate-200 rounded-xl">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay usuarios registrados</p>
            <p className="text-xs mt-1 text-slate-300">Crea el primer usuario con el botón de arriba</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Usuario', 'Nombre', 'Rol'].map(col => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuariosExistentes.map((u, i) => (
                  <tr key={u.id ?? u.username ?? i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0">
                    <td className="px-4 py-3 font-mono text-slate-800 text-sm">{u.username ?? u.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{u.nombre ?? u.display_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full
                        ${u.rol === 'ADMIN'      ? 'bg-violet-100 text-violet-700' :
                          u.rol === 'SCANNER'    ? 'bg-blue-100 text-blue-700' :
                          u.rol === 'PLANILLERO' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-600'}`}>
                        {u.rol ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <ModalCrearUsuario onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function TrabundaPage() {
  const { user }     = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  const [tab,        setTab]        = useState('resumen');
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  async function fetchDashboard() {
    setLoading(true); setError(null);
    try {
      const res = await apiGetTrabundaDashboard();
      setData(res);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60_000);
    return () => clearInterval(interval);
  }, []);

  const TABS = [
    { id: 'resumen',  label: 'Resumen'  },
    { id: 'reportes', label: 'Reportes' },
    ...(isSuperadmin ? [{ id: 'usuarios', label: 'Usuarios', badge: 'SA' }] : []),
  ];

  return (
    <Layout
      title="Trabunda"
      subtitle={lastUpdate ? `Actualizado: ${lastUpdate}` : 'App móvil de gestión operativa'}
    >
      <div className="space-y-6 max-w-[1200px]">

        {/* ── Tabs + Refresh ─────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all
                  ${tab === t.id
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {t.label}
                {t.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-bold leading-none">{t.badge}</span>
                )}
              </button>
            ))}
          </div>

          {tab === 'resumen' && (
            <button
              onClick={fetchDashboard}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          )}
        </div>

        {/* Error de conexión */}
        {error && tab === 'resumen' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
            <XCircle size={20} className="text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-700">Error de conexión</p>
              <p className="text-sm text-red-500">{error}</p>
            </div>
          </div>
        )}

        {/* Backend no configurado */}
        {data && !data.configured && <NotConfigured />}

        {/* ── Contenido del tab activo ───────────────────────────── */}
        {tab === 'resumen'  && <TabResumen data={data} loading={loading} />}
        {tab === 'reportes' && <TabReportes />}
        {tab === 'usuarios' && isSuperadmin && <TabUsuarios data={data} />}

      </div>
    </Layout>
  );
}
