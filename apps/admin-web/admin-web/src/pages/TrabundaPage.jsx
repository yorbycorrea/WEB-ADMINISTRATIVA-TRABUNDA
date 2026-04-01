import { useState, useEffect } from 'react';
import {
  RefreshCw, Clock, Users, FileText, CheckCircle, XCircle,
  AlertCircle, Database, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Layout from '../components/Layout';
import { apiGetTrabundaDashboard, apiGetTrabundaReportes } from '../api/gateway';

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

// ─── Tab: Reportes ────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

function TabReportes() {
  const [fecha,    setFecha]    = useState(hoy());
  const [tipo,     setTipo]     = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [reportes, setReportes] = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [pagina,   setPagina]   = useState(0);

  async function cargar(f = fecha, t = tipo, p = 0) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetTrabundaReportes({ fecha: f, tipo: t, limit: PAGE_SIZE, offset: p * PAGE_SIZE });
      setReportes(data?.reportes ?? []);
      setTotal(data?.total ?? 0);
      setPagina(p);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Carga inicial
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiltrar(e) {
    e.preventDefault();
    cargar(fecha, tipo, 0);
  }

  // Filtro de búsqueda en cliente (sobre los registros ya cargados)
  const reportesFiltrados = busqueda.trim()
    ? reportes.filter(r =>
        JSON.stringify(r).toLowerCase().includes(busqueda.toLowerCase())
      )
    : reportes;

  const totalPaginas = Math.ceil(total / PAGE_SIZE);

  // Detectamos las columnas del primer reporte para la tabla dinámica
  const columnas = reportes.length > 0
    ? Object.keys(reportes[0]).filter(k => k !== 'password')
    : [];

  // Formatea un valor para mostrarlo en la celda
  function fmtValor(val) {
    if (val === null || val === undefined) return <span className="text-slate-300">—</span>;
    if (typeof val === 'boolean') return val ? <span className="text-emerald-500 text-xs">✓ Sí</span> : <span className="text-slate-400 text-xs">No</span>;
    if (typeof val === 'object') return <span className="text-xs text-slate-400 italic">{JSON.stringify(val)}</span>;
    // Detectar fechas ISO
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
      return new Date(val).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    }
    return String(val);
  }

  // Nombre legible para la columna (snake_case → Título)
  function fmtCol(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  return (
    <div className="space-y-5">

      {/* ── Filtros ──────────────────────────────────────────────── */}
      <form onSubmit={handleFiltrar} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Fecha */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={e => setFecha(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Tipo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 bg-white"
            >
              <option value="">Todos los tipos</option>
              {MODULOS.map(m => (
                <option key={m.tipo} value={m.tipo}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Botón */}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all"
          >
            <Search size={14} />
            Buscar
          </button>

          {/* Búsqueda en cliente */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtrar resultados</label>
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar en los resultados..."
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </form>

      {/* ── Resultado ────────────────────────────────────────────── */}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
          <XCircle size={20} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header de la tabla */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              {loading ? 'Cargando...' : `${total} reporte${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
            </p>
            <p className="text-xs text-slate-400">
              Fecha: {fecha} {tipo ? `· Tipo: ${TIPO_LABELS[tipo]?.label ?? tipo}` : '· Todos los tipos'}
            </p>
          </div>
          {totalPaginas > 1 && (
            <p className="text-xs text-slate-400">
              Página {pagina + 1} de {totalPaginas}
            </p>
          )}
        </div>

        {/* Skeleton */}
        {loading && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Sin resultados */}
        {!loading && reportesFiltrados.length === 0 && (
          <div className="p-12 text-center">
            <FileText size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="font-semibold text-slate-500">Sin reportes para esta fecha</p>
            <p className="text-sm text-slate-400 mt-1">Intenta cambiar la fecha o el tipo de reporte</p>
          </div>
        )}

        {/* Tabla dinámica */}
        {!loading && reportesFiltrados.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {columnas.map(col => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {fmtCol(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportesFiltrados.map((reporte, i) => (
                  <tr key={reporte.id ?? i} className="hover:bg-slate-50 transition-colors">
                    {columnas.map(col => (
                      <td key={col} className="px-4 py-3 text-slate-700 whitespace-nowrap max-w-[250px] truncate">
                        {col === 'tipo_reporte' || col === 'tipo'
                          ? <TipoBadge tipo={reporte[col]} />
                          : fmtValor(reporte[col])
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {!loading && totalPaginas > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => cargar(fecha, tipo, pagina - 1)}
              disabled={pagina === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all"
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <span className="text-sm text-slate-500">
              Mostrando {pagina * PAGE_SIZE + 1}–{Math.min((pagina + 1) * PAGE_SIZE, total)} de {total}
            </span>
            <button
              onClick={() => cargar(fecha, tipo, pagina + 1)}
              disabled={pagina >= totalPaginas - 1}
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
