import { useState, useEffect } from 'react';
import {
  RefreshCw, Clock, Users, FileText, CheckCircle, XCircle,
  AlertCircle, Database, Search, ChevronLeft, ChevronRight,
  Download,
} from 'lucide-react';
import Layout from '../components/Layout';
import { apiGetTrabundaDashboard, apiGetTrabundaReportes, apiGetTrabundaReporteDetalle } from '../api/gateway';
import { exportToPDF, exportToExcel, exportReporteDetallePDF } from '../utils/exportUtils';

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
  // ID del reporte que está siendo descargado (para mostrar spinner en esa fila)
  const [descargando, setDescargando] = useState(null);

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
                    {/* Botón de descarga individual — llama al endpoint de detalle */}
                    <td className="px-4 py-3 text-right">
                      <button
                        disabled={descargando === reporte.id}
                        onClick={async () => {
                          setDescargando(reporte.id);
                          try {
                            const detalle = await apiGetTrabundaReporteDetalle(reporte.id);
                            exportReporteDetallePDF(detalle.cabecera, detalle.contenido, detalle.tipo);
                          } catch {
                            alert('No se pudo descargar el reporte');
                          } finally {
                            setDescargando(null);
                          }
                        }}
                        title={`Descargar reporte #${reporte.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition-all disabled:opacity-50"
                      >
                        {descargando === reporte.id
                          ? <RefreshCw size={11} className="animate-spin" />
                          : <Download size={11} />
                        }
                        PDF
                      </button>
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

// ─── Página principal ─────────────────────────────────────────────────────────

export default function TrabundaPage() {
  const [tab,        setTab]        = useState('resumen');
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  async function fetchDashboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetTrabundaDashboard();
      setData(res);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60_000);
    return () => clearInterval(interval);
  }, []);

  const TABS = [
    { id: 'resumen',  label: 'Resumen'  },
    { id: 'reportes', label: 'Reportes' },
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
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all
                  ${tab === t.id
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {t.label}
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

      </div>
    </Layout>
  );
}
