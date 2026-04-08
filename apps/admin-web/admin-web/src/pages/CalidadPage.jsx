import { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical, Thermometer, Scale, ClipboardCheck, Eye, Plus, Pencil, Power,
  RefreshCw, CheckCircle, XCircle, AlertCircle, Search, ChevronLeft, ChevronRight,
  Bot, X, Database, Shield,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  apiGetCalidadDashboard,
  apiGetCalidadReportesPesos,
  apiGetCalidadPesoDetalle,
  apiGetCalidadReportesTemperatura,
  apiGetCalidadTemperaturaDetalle,
  apiGetCalidadReportesOrganoletica,
  apiGetCalidadOrganoleticaDetalle,
  apiGetCalidadOcrEstado,
  apiGetCalidadProductos,
  apiCreateCalidadProducto,
  apiUpdateCalidadProducto,
  apiToggleCalidadProducto,
  apiGetCalidadSupervisores,
  apiGetCalidadOrugas,
} from '../api/gateway';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFecha(val) {
  if (!val) return '—';
  try {
    const d = new Date(val);
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return String(val); }
}

function fmtFechaISO(val) {
  if (!val) return '';
  try { return new Date(val).toISOString().split('T')[0]; }
  catch { return ''; }
}

// ─── Componentes reutilizables ────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'emerald' }) {
  const colors = {
    emerald: 'text-emerald-600',
    green:   'text-green-600',
    teal:    'text-teal-600',
    blue:    'text-blue-600',
    amber:   'text-amber-600',
    violet:  'text-violet-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color] ?? colors.emerald}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBadge({ ok, label }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
      ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
      {ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
      {label}
    </div>
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
{`CALIDAD_BACKEND_URL=http://vserver.trabunda.com:3010/api
CALIDAD_ADMIN_USER=admin
CALIDAD_ADMIN_PASS=tu_password`}
      </pre>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw size={32} className="animate-spin text-emerald-500" />
    </div>
  );
}

function EmptyRow({ cols, msg = 'Sin registros' }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-slate-400 text-sm">{msg}</td>
    </tr>
  );
}

// ─── Modal de detalle genérico ────────────────────────────────────────────────

function DetalleModal({ title, data, loading, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <Spinner />
          ) : !data ? (
            <p className="text-slate-400 text-sm text-center py-8">Sin datos disponibles</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(data).map(([k, v]) => (
                <div key={k} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-0.5 capitalize">{k.replace(/_/g, ' ')}</p>
                  <p className="font-semibold text-slate-800 text-sm break-all">
                    {v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

function TabDashboard({ data, loading, onRefresh }) {
  if (loading) return <Spinner />;
  if (!data)   return null;
  if (data.configured === false) return <NotConfigured />;

  const health     = data.health ?? {};
  const apiOk = health.status === 'ok' || health.status === 'online' || health.ok === true || !!health.status;

  // Intenta detectar el estado de la BD en distintas estructuras posibles.
  // Si no hay campo explícito pero la API responde OK, asumimos que la BD está bien.
  const dbExplicit =
    health.database === 'ok'        || health.database === 'connected'  ||
    health.db       === 'ok'        || health.db       === 'connected'  ||
    health.db_status === 'ok'       ||
    health.services?.database === 'ok'  || health.services?.mysql === 'ok'   ||
    health.mysql?.connected === true    || health.database?.status === 'ok'  ||
    health.db?.status === 'ok';
  const dbOk = dbExplicit || (apiOk && health.database !== false && health.db !== false && health.database !== 'error' && health.db !== 'error');
  const pesosHoy   = data.pesosHoy   ?? { total: 0, items: [] };
  const tempHoy    = data.temperaturaHoy  ?? { total: 0, items: [] };
  const orgHoy     = data.organoleticaHoy ?? { total: 0, items: [] };
  const supervisores = data.supervisores ?? [];

  return (
    <div className="space-y-6">
      {/* Estado del sistema */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-slate-800 text-base">Estado del Sistema</h2>
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <StatusBadge ok={apiOk} label="API Backend" />
          <StatusBadge ok={dbOk}  label="Base de datos" />
          {data.ocrEstado && (
            <StatusBadge ok={data.ocrEstado.activo ?? data.ocrEstado.online ?? !!data.ocrEstado.estado} label="Servicio OCR" />
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pesos Hoy"        value={pesosHoy.total}    color="emerald" sub="registros de peso" />
        <StatCard label="Temperatura Hoy"  value={tempHoy.total}     color="blue"    sub="registros de temp." />
        <StatCard label="Organoléptica Hoy" value={orgHoy.total}     color="teal"    sub="registros organ." />
        <StatCard label="Supervisores"     value={supervisores.length} color="amber" sub="activos en sistema" />
      </div>

      {/* Últimos registros de pesos */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <Scale size={18} className="text-emerald-600" />
          <h3 className="font-bold text-slate-800">Últimos Registros de Peso</h3>
          <span className="ml-auto text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {pesosHoy.items?.length ?? 0} de {pesosHoy.total}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['ID', 'Producto', 'Oruga', 'Supervisor', 'Peso', 'Fecha'].map(col => (
                  <th key={col} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(pesosHoy.items ?? []).length === 0 ? (
                <EmptyRow cols={6} msg="Sin registros de peso hoy" />
              ) : (
                (pesosHoy.items ?? []).map((p, i) => (
                  <tr key={p.id ?? i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0">
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{p.id ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.producto ?? p.nombre_producto ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.oruga ?? p.nombre_oruga ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.supervisor ?? p.nombre_supervisor ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-emerald-700 font-semibold">{p.peso ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtFecha(p.fecha ?? p.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-tab genérico de reportes ─────────────────────────────────────────────

function ReporteSubTab({ tipo, fetchFn, fetchDetalleFn, columns, rowRenderer }) {
  const today = new Date().toISOString().split('T')[0];
  const [fecha,   setFecha]   = useState(today);
  const [q,       setQ]       = useState('');
  const [page,    setPage]    = useState(1);
  const LIMIT = 25;

  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [modal,   setModal]   = useState(null);  // { data, loading }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const fetchData = useCallback(async (p, f, search) => {
    setLoading(true); setError(null);
    try {
      const params = { page: p, limit: LIMIT, fecha: f || undefined };
      if (search) params.q = search;
      const res = await fetchFn(params);
      if (res?.error || res?.ok === false) {
        setError(res.error ?? 'Error al cargar datos');
        setItems([]); setTotal(0);
      } else {
        const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
        setItems(arr);
        setTotal(res?.total ?? arr.length);
      }
    } catch (e) { setError(e.message); setItems([]); setTotal(0); }
    finally { setLoading(false); }
  }, [fetchFn]);

  useEffect(() => { fetchData(page, fecha, q); }, [page, fecha, q, fetchData]);

  function handleBuscar() { setPage(1); fetchData(1, fecha, q); }
  function handleLimpiar() { setFecha(today); setQ(''); setPage(1); }

  async function openDetalle(id) {
    setModal({ data: null, loading: true });
    try {
      const res = await fetchDetalleFn(id);
      setModal({ data: res, loading: false });
    } catch (e) {
      setModal({ data: { error: e.message }, loading: false });
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        {tipo === 'pesos' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Buscar</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Producto, oruga..."
                value={q}
                onChange={e => setQ(e.target.value)}
                className="pl-8 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-52"
              />
            </div>
          </div>
        )}
        <button
          onClick={handleBuscar}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-2"
        >
          <Search size={14} /> Buscar
        </button>
        <button
          onClick={handleLimpiar}
          className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all"
        >
          Limpiar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-100 text-red-600 text-sm flex items-center gap-2">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {columns.map(col => (
                  <th key={col} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                ))}
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center"><RefreshCw size={24} className="animate-spin text-emerald-500 mx-auto" /></td></tr>
              ) : items.length === 0 ? (
                <EmptyRow cols={columns.length + 1} msg="Sin registros para los filtros aplicados" />
              ) : (
                items.map((item, i) => (
                  <tr key={item.id ?? i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0">
                    {rowRenderer(item)}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => openDetalle(item.id)}
                        title="Ver detalle"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && items.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              Página {page} de {totalPages} · {total} registros totales
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 transition-all"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-white disabled:opacity-40 transition-all"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal detalle */}
      {modal && (
        <DetalleModal
          title={`Detalle de ${tipo}`}
          data={modal.data}
          loading={modal.loading}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── Tab: Reportes ────────────────────────────────────────────────────────────

function TabReportes() {
  const [subTab, setSubTab] = useState('pesos');

  const subTabs = [
    { id: 'pesos',        label: 'Pesos',         icon: <Scale size={15} /> },
    { id: 'temperatura',  label: 'Temperatura',    icon: <Thermometer size={15} /> },
    { id: 'organoletica', label: 'Organoléptica',  icon: <ClipboardCheck size={15} /> },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 bg-slate-100 rounded-2xl p-1.5 w-fit">
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${subTab === t.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {subTab === 'pesos' && (
        <ReporteSubTab
          tipo="pesos"
          fetchFn={apiGetCalidadReportesPesos}
          fetchDetalleFn={apiGetCalidadPesoDetalle}
          columns={['ID', 'Producto', 'Oruga', 'Supervisor', 'Peso', 'Fecha']}
          rowRenderer={p => (
            <>
              <td className="px-4 py-3 text-xs font-mono text-slate-400">{p.id ?? '—'}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{p.producto ?? p.nombre_producto ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600">{p.oruga ?? p.nombre_oruga ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600">{p.supervisor ?? p.nombre_supervisor ?? '—'}</td>
              <td className="px-4 py-3 font-mono font-semibold text-emerald-700">{p.peso ?? '—'}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{fmtFecha(p.fecha ?? p.created_at)}</td>
            </>
          )}
        />
      )}

      {subTab === 'temperatura' && (
        <ReporteSubTab
          tipo="temperatura"
          fetchFn={apiGetCalidadReportesTemperatura}
          fetchDetalleFn={apiGetCalidadTemperaturaDetalle}
          columns={['ID', 'Producto', 'Supervisor', 'Temperatura', 'Fecha']}
          rowRenderer={p => (
            <>
              <td className="px-4 py-3 text-xs font-mono text-slate-400">{p.id ?? '—'}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{p.producto ?? p.nombre_producto ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600">{p.supervisor ?? p.nombre_supervisor ?? '—'}</td>
              <td className="px-4 py-3 font-mono font-semibold text-blue-700">{p.temperatura ?? p.valor ?? '—'}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{fmtFecha(p.fecha ?? p.created_at)}</td>
            </>
          )}
        />
      )}

      {subTab === 'organoletica' && (
        <ReporteSubTab
          tipo="organoléptica"
          fetchFn={apiGetCalidadReportesOrganoletica}
          fetchDetalleFn={apiGetCalidadOrganoleticaDetalle}
          columns={['ID', 'Producto', 'Supervisor', 'Resultado', 'Fecha']}
          rowRenderer={p => (
            <>
              <td className="px-4 py-3 text-xs font-mono text-slate-400">{p.id ?? '—'}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{p.producto ?? p.nombre_producto ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600">{p.supervisor ?? p.nombre_supervisor ?? '—'}</td>
              <td className="px-4 py-3">
                {p.resultado != null ? (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full
                    ${String(p.resultado).toLowerCase() === 'aprobado' || p.resultado === true || p.resultado === 1
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'}`}>
                    {String(p.resultado)}
                  </span>
                ) : '—'}
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">{fmtFecha(p.fecha ?? p.created_at)}</td>
            </>
          )}
        />
      )}
    </div>
  );
}

// ─── Tab: Administración ──────────────────────────────────────────────────────

function TabAdministracion() {
  const [subTab, setSubTab] = useState('productos');

  const subTabs = [
    { id: 'productos',   label: 'Productos',   icon: <ClipboardCheck size={15} /> },
    { id: 'supervisores', label: 'Supervisores', icon: <Shield size={15} /> },
    { id: 'orugas',      label: 'Orugas',       icon: <Database size={15} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-slate-100 rounded-2xl p-1.5 w-fit">
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
              ${subTab === t.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {subTab === 'productos'    && <AdminProductos />}
      {subTab === 'supervisores' && <AdminCatalogo fetchFn={apiGetCalidadSupervisores} nombre="Supervisores" campoNombre="nombre" />}
      {subTab === 'orugas'       && <AdminCatalogo fetchFn={apiGetCalidadOrugas}      nombre="Orugas"       campoNombre="nombre" />}
    </div>
  );
}

// ─── Sub-tab: Catálogo de solo lectura ────────────────────────────────────────

function AdminCatalogo({ fetchFn, nombre, campoNombre }) {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetchFn();
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      setItems(arr);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [fetchFn]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="font-bold text-slate-800">{nombre}</h3>
        <button onClick={load} className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all" title="Recargar">
          <RefreshCw size={15} />
        </button>
      </div>
      {error && (
        <div className="px-6 py-3 bg-red-50 text-red-600 text-sm flex items-center gap-2 border-b border-red-100">
          <AlertCircle size={14} /> {error}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">ID</th>
              <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2} className="px-4 py-10 text-center"><RefreshCw size={24} className="animate-spin text-emerald-500 mx-auto" /></td></tr>
            ) : items.length === 0 ? (
              <EmptyRow cols={2} />
            ) : (
              items.map((item, i) => (
                <tr key={item.id ?? i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0">
                  <td className="px-4 py-3 text-xs font-mono text-slate-400">{item.id ?? i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{item[campoNombre] ?? JSON.stringify(item)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Sub-tab: Productos con CRUD ──────────────────────────────────────────────

function AdminProductos() {
  const [productos, setProductos] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState(null);  // null = cerrado, {} = nuevo, {id,...} = editar

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiGetCalidadProductos();
      const arr = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
      setProductos(arr);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleGuardar() {
    if (!form?.nombre?.trim()) return;
    setSaving(true);
    try {
      if (form.id) {
        await apiUpdateCalidadProducto(form.id, { nombre: form.nombre });
      } else {
        await apiCreateCalidadProducto({ nombre: form.nombre });
      }
      setForm(null);
      load();
    } catch (e) { alert('Error al guardar: ' + e.message); }
    finally { setSaving(false); }
  }

  async function handleToggle(prod) {
    try {
      await apiToggleCalidadProducto(prod.id, !prod.activo);
      load();
    } catch (e) { alert('Error al cambiar estado: ' + e.message); }
  }

  return (
    <div className="space-y-4">
      {/* Formulario */}
      {form !== null && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">{form.id ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre</label>
              <input
                type="text"
                value={form.nombre ?? ''}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del producto"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={handleGuardar}
              disabled={saving || !form?.nombre?.trim()}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : null}
              {form.id ? 'Guardar' : 'Crear'}
            </button>
            <button
              onClick={() => setForm(null)}
              className="px-4 py-2 bg-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-300 transition-all"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Productos</h3>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all" title="Recargar">
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setForm({ nombre: '' })}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all"
            >
              <Plus size={14} /> Nuevo
            </button>
          </div>
        </div>
        {error && (
          <div className="px-6 py-3 bg-red-50 text-red-600 text-sm flex items-center gap-2 border-b border-red-100">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['ID', 'Nombre', 'Estado', 'Acciones'].map(col => (
                  <th key={col} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center"><RefreshCw size={24} className="animate-spin text-emerald-500 mx-auto" /></td></tr>
              ) : productos.length === 0 ? (
                <EmptyRow cols={4} />
              ) : (
                productos.map((p, i) => (
                  <tr key={p.id ?? i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0">
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{p.id ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.nombre ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full
                        ${p.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setForm({ id: p.id, nombre: p.nombre })}
                          title="Editar"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleToggle(p)}
                          title={p.activo ? 'Desactivar' : 'Activar'}
                          className={`p-1.5 rounded-lg transition-all
                            ${p.activo
                              ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                        >
                          <Power size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: OCR ────────────────────────────────────────────────────────────────

function TabOCR() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiGetCalidadOcrEstado();
      if (res?.error || res?.ok === false) {
        setError(res.error ?? 'Error al obtener estado OCR');
      } else {
        setData(res);
      }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const online = data?.activo ?? data?.online ?? data?.estado === 'online' ?? false;

  return (
    <div className="max-w-xl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Bot size={20} />
            </div>
            <h3 className="font-bold text-slate-800">Servicio OCR</h3>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <Spinner />
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-600">
              <AlertCircle size={18} /> <span className="text-sm">{error}</span>
            </div>
          ) : !data ? (
            <div className="text-slate-400 text-sm text-center py-6">Sin datos del servicio OCR</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge ok={online} label={online ? 'En línea' : 'Fuera de línea'} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {Object.entries(data).map(([k, v]) => (
                  <div key={k} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-0.5 capitalize">{k.replace(/_/g, ' ')}</p>
                    <p className="font-semibold text-slate-800 text-sm break-all">
                      {v === null || v === undefined
                        ? '—'
                        : typeof v === 'boolean'
                          ? (v ? 'Sí' : 'No')
                          : typeof v === 'object'
                            ? JSON.stringify(v)
                            : String(v)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CalidadPage() {
  const { user } = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  const [activeTab,    setActiveTab]    = useState('dashboard');
  const [dashData,     setDashData]     = useState(null);
  const [dashLoading,  setDashLoading]  = useState(true);
  const [lastUpdated,  setLastUpdated]  = useState(null);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const res = await apiGetCalidadDashboard();
      setDashData(res);
      setLastUpdated(new Date());
    } catch (e) {
      setDashData({ configured: false, error: e.message });
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const tabs = [
    { id: 'dashboard',      label: 'Dashboard',      icon: <FlaskConical size={15} /> },
    { id: 'reportes',       label: 'Reportes',        icon: <ClipboardCheck size={15} /> },
    ...(isSuperadmin ? [{ id: 'admin', label: 'Administración', icon: <Shield size={15} /> }] : []),
    { id: 'ocr',            label: 'OCR',             icon: <Bot size={15} /> },
  ];

  const subtitle = lastUpdated
    ? `Última actualización: ${lastUpdated.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    : 'Cargando datos...';

  return (
    <Layout title="Calidad" subtitle={subtitle}>
      <div className="space-y-6">

        {/* Tabs principales */}
        <div className="flex gap-2 bg-white border border-slate-200 rounded-2xl p-1.5 w-fit shadow-sm">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all
                ${activeTab === t.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        {activeTab === 'dashboard' && (
          <TabDashboard data={dashData} loading={dashLoading} onRefresh={loadDashboard} />
        )}
        {activeTab === 'reportes' && <TabReportes />}
        {activeTab === 'admin'    && <TabAdministracion />}
        {activeTab === 'ocr'      && <TabOCR />}
      </div>
    </Layout>
  );
}
