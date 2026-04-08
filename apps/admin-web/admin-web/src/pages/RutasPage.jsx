import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RefreshCw, Truck, Users, ScanLine, CheckCircle, XCircle, AlertCircle,
  Database, Search, X, ChevronLeft, ChevronRight,
  FileText, FileSpreadsheet, Eye, Settings, LayoutDashboard, BarChart2, Shield,
  Plus, Power, AlertTriangle, MapPin, UserCheck,
} from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import {
  apiGetRutasDashboard,
  apiGetRutasReportes,
  apiGetRutasJornadaResumen,
  apiGetRutasJornadaDetalle,
  apiGetRutasAdminRutas,
  apiCreateRuta,
  apiToggleRuta,
  apiGetTrabajadoresSinArea,
  apiGetRutasAreas,
  apiAsignarAreaTrabajador,
  apiAsignarAreaBulk,
  apiGetRutasTrabajadores,
} from '../api/gateway';
import {
  exportRutasJornadasPDF,
  exportRutasJornadasExcel,
  exportRutasJornadaDetallePDF,
  exportRutasJornadaDetalleExcel,
} from '../utils/exportUtils';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_LABELS = {
  ABIERTA:    'Abierta',
  EN_PROCESO: 'En Proceso',
  FINALIZADA: 'Finalizada',
};

const ESTADO_BADGE = {
  ABIERTA:    'bg-amber-100 text-amber-700 border border-amber-200',
  EN_PROCESO: 'bg-blue-100 text-blue-700 border border-blue-200',
  FINALIZADA: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

const LIMIT = 100;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtFechaCorta(val) {
  if (!val) return '—';
  try { const [y, m, d] = String(val).split('-'); return `${d}/${m}/${y}`; }
  catch { return String(val); }
}

function fmtHoraISO(val) {
  if (!val) return '—';
  try { return new Date(val).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

// ─── UI compartida ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = { blue: 'text-blue-600', emerald: 'text-emerald-600', violet: 'text-violet-600', amber: 'text-amber-600' };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value ?? '—'}</p>
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
{`RUTAS_BACKEND_URL=http://tu-servidor:puerto
RUTAS_ADMIN_USER=admin
RUTAS_ADMIN_PASS=tu_password`}
      </pre>
    </div>
  );
}

function EmpresaCard({ empresa }) {
  const activa         = !!empresa.activo;
  const transportistas = empresa.transportistas ?? [];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${activa ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
            <Truck size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">{empresa.nombre}</h3>
            <span className="text-xs text-slate-400">ID: {empresa.id_empresa_transporte}</span>
          </div>
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${activa ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {activa ? 'Activa' : 'Inactiva'}
        </span>
      </div>
      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={13} className="text-slate-400" />
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Transportistas ({transportistas.length})
          </span>
        </div>
        {transportistas.length === 0 ? (
          <p className="text-xs text-slate-400 italic">Sin transportistas registrados</p>
        ) : (
          <ul className="space-y-2">
            {transportistas.slice(0, 4).map(t => (
              <li key={t.id_transportista} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 font-medium">{t.nombre}</span>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg font-mono">
                  {t.placa ?? 'sin placa'}
                </span>
              </li>
            ))}
            {transportistas.length > 4 && (
              <li className="text-xs text-slate-400">+{transportistas.length - 4} más...</li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function EstadoBadge({ estado }) {
  const cls   = ESTADO_BADGE[estado] ?? 'bg-slate-100 text-slate-600 border border-slate-200';
  const label = ESTADO_LABELS[estado] ?? estado ?? '—';
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>;
}

// ─── Modal detalle de jornada ─────────────────────────────────────────────────

function JornadaModal({ jornada, resumen, detalle, loading, onClose, onPDF, onExcel }) {
  const trabajadores = detalle?.items ?? [];
  const stats        = resumen?.resumen ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Jornada #{jornada.id_jornada} — Control de Movilidad</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-500">{fmtFechaCorta(jornada.fecha)}</span>
              <span className="text-slate-300">·</span>
              <span className="text-sm text-slate-500 font-mono">{jornada.placa ?? '—'}</span>
              <span className="text-slate-300">·</span>
              <EstadoBadge estado={jornada.estado_actual} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onPDF}   disabled={loading} className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 transition-all disabled:opacity-50">
              <FileText size={14} /> PDF
            </button>
            <button onClick={onExcel} disabled={loading} className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all disabled:opacity-50">
              <FileSpreadsheet size={14} /> Excel
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
              <X size={18} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <RefreshCw size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Cargando detalle...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 border-b border-slate-100 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'ID Turno', value: jornada.id_turno ?? '—' },
                  { label: 'ID Ruta',  value: jornada.id_ruta  ?? '—' },
                  { label: 'Empresa',  value: `#${jornada.id_empresa_transporte ?? '—'}` },
                  { label: 'Sesiones', value: stats?.sesiones_involucradas ?? '—' },
                ].map(item => (
                  <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs text-slate-400 mb-0.5">{item.label}</p>
                    <p className="font-bold text-slate-800">{item.value}</p>
                  </div>
                ))}
              </div>
              {stats && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-emerald-700">{stats.total_marcados}</p>
                    <p className="text-xs text-emerald-600 mt-1 font-semibold uppercase tracking-wide">Marcados</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-blue-700">{stats.total_asignados}</p>
                    <p className="text-xs text-blue-600 mt-1 font-semibold uppercase tracking-wide">Asignados</p>
                  </div>
                  <div className={`border rounded-xl p-4 text-center ${stats.faltantes > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-3xl font-bold ${stats.faltantes > 0 ? 'text-red-700' : 'text-slate-400'}`}>{stats.faltantes}</p>
                    <p className={`text-xs mt-1 font-semibold uppercase tracking-wide ${stats.faltantes > 0 ? 'text-red-600' : 'text-slate-400'}`}>Faltantes</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6">
              <h3 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-4">
                Trabajadores marcados ({trabajadores.length})
              </h3>
              {trabajadores.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin registros de marcación en esta jornada</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        {['N°', 'DNI', 'Apellidos y Nombres', 'Cargo', 'Hora', 'Origen'].map(col => (
                          <th key={col} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trabajadores.map((t, i) => (
                        <tr key={t.id_trabajador} className="border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0">
                          <td className="px-4 py-3 text-xs text-slate-400 font-mono">{i + 1}</td>
                          <td className="px-4 py-3 font-mono text-slate-700">{t.dni ?? '—'}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {`${(t.apellidos ?? '').toUpperCase()} ${t.nombres ?? ''}`.trim() || '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{t.cargo ?? '—'}</td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-700">{fmtHoraISO(t.fecha_hora)}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{t.origen ?? '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Reportes ────────────────────────────────────────────────────────────

function TabReportesRutas() {
  const today = new Date().toISOString().split('T')[0];
  const [filters, setFilters] = useState({ fecha: today, id_turno: '', id_ruta: '', placa: '', estado: '' });
  const [applied, setApplied] = useState({ fecha: today, id_turno: '', id_ruta: '', placa: '', estado: '' });
  const [jornadas, setJornadas] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [offset,   setOffset]   = useState(0);
  const [hasMore,  setHasMore]  = useState(false);
  const [modal,    setModal]    = useState(null);

  const fetchReportes = useCallback(async (f, off) => {
    setLoading(true); setError(null);
    try {
      const res = await apiGetRutasReportes({
        fecha: f.fecha || undefined, id_turno: f.id_turno || undefined,
        id_ruta: f.id_ruta || undefined, placa: f.placa || undefined,
        estado: f.estado || undefined, limit: LIMIT, offset: off,
      });
      if (res?.ok === false || res?.error) {
        setError(res.error ?? res.message ?? 'Error al cargar reportes');
        setJornadas([]); setHasMore(false);
      } else {
        const items = res.items ?? [];
        setJornadas(items); setHasMore(items.length === LIMIT);
      }
    } catch (e) { setError(e.message); setJornadas([]); setHasMore(false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchReportes(applied, offset); }, [applied, offset, fetchReportes]);

  function handleBuscar() { setOffset(0); setApplied({ ...filters }); }
  function handleLimpiar() {
    const clean = { fecha: today, id_turno: '', id_ruta: '', placa: '', estado: '' };
    setFilters(clean); setApplied(clean); setOffset(0);
  }

  async function openModal(jornada) {
    setModal({ jornada, resumen: null, detalle: null, loading: true });
    try {
      const [r, d] = await Promise.all([
        apiGetRutasJornadaResumen(jornada.id_jornada),
        apiGetRutasJornadaDetalle(jornada.id_jornada),
      ]);
      setModal({ jornada, resumen: r, detalle: d, loading: false });
    } catch { setModal(prev => ({ ...prev, loading: false })); }
  }

  async function quickExportPDF(j) {
    const [r, d] = await Promise.all([apiGetRutasJornadaResumen(j.id_jornada), apiGetRutasJornadaDetalle(j.id_jornada)]);
    exportRutasJornadaDetallePDF(j, r?.resumen ?? null, d?.items ?? []);
  }
  async function quickExportExcel(j) {
    const [r, d] = await Promise.all([apiGetRutasJornadaResumen(j.id_jornada), apiGetRutasJornadaDetalle(j.id_jornada)]);
    exportRutasJornadaDetalleExcel(j, r?.resumen ?? null, d?.items ?? []);
  }

  const hasPrev     = offset > 0;
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-4">Filtros de búsqueda</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Fecha <span className="text-red-400">*</span></label>
            <input type="date" value={filters.fecha} onChange={e => setFilters(p => ({ ...p, fecha: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleBuscar()}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Estado</label>
            <select value={filters.estado} onChange={e => setFilters(p => ({ ...p, estado: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos</option>
              <option value="ABIERTA">Abierta</option>
              <option value="EN_PROCESO">En Proceso</option>
              <option value="FINALIZADA">Finalizada</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Placa</label>
            <input type="text" value={filters.placa}
              onChange={e => setFilters(p => ({ ...p, placa: e.target.value.toUpperCase() }))}
              onKeyDown={e => e.key === 'Enter' && handleBuscar()}
              placeholder="Ej: P16-752" maxLength={10}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase placeholder:font-sans placeholder:normal-case" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">ID Turno</label>
            <input type="number" value={filters.id_turno} min={1}
              onChange={e => setFilters(p => ({ ...p, id_turno: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleBuscar()} placeholder="Ej: 1"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">ID Ruta</label>
            <input type="number" value={filters.id_ruta} min={1}
              onChange={e => setFilters(p => ({ ...p, id_ruta: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleBuscar()} placeholder="Ej: 2"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button onClick={handleBuscar} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-sm shadow-blue-200">
              <Search size={14} /> Buscar
            </button>
            <button onClick={handleLimpiar} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50">
              <X size={14} /> Limpiar
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 mr-1">Exportar lista:</span>
            <button onClick={() => exportRutasJornadasPDF(jornadas, applied.fecha)} disabled={loading || jornadas.length === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-red-50 text-red-700 border border-red-200 rounded-xl hover:bg-red-100 transition-all disabled:opacity-40">
              <FileText size={14} /> PDF
            </button>
            <button onClick={() => exportRutasJornadasExcel(jornadas, applied.fecha)} disabled={loading || jornadas.length === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all disabled:opacity-40">
              <FileSpreadsheet size={14} /> Excel
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <XCircle size={18} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-700 text-sm">Error al cargar reportes</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <p className="text-sm text-slate-500">
            {loading ? 'Cargando jornadas...' : `${jornadas.length} jornada${jornadas.length !== 1 ? 's' : ''} encontrada${jornadas.length !== 1 ? 's' : ''}`}
          </p>
          {loading && <RefreshCw size={14} className="animate-spin text-blue-500" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['ID', 'Fecha', 'ID Turno', 'ID Ruta', 'Placa', 'Estado', 'Marcados', 'Sesiones', 'Acciones'].map(col => (
                  <th key={col} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && jornadas.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded animate-pulse" style={{ width: `${60 + (j * 7) % 30}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : jornadas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center text-slate-400">
                    <BarChart2 size={36} className="mx-auto mb-3 opacity-25" />
                    <p className="text-sm font-medium">No se encontraron jornadas</p>
                    <p className="text-xs mt-1 text-slate-300">Ajusta los filtros y vuelve a buscar</p>
                  </td>
                </tr>
              ) : (
                jornadas.map(j => (
                  <tr key={j.id_jornada} className="border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">#{j.id_jornada}</td>
                    <td className="px-4 py-3 text-slate-700">{fmtFechaCorta(j.fecha)}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{j.id_turno ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-700">{j.id_ruta ?? '—'}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-800">{j.placa ?? '—'}</td>
                    <td className="px-4 py-3"><EstadoBadge estado={j.estado_actual} /></td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800">{j.total_marcados ?? 0}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{j.sesiones_involucradas ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => openModal(j)} title="Ver detalle" className="p-2 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"><Eye size={14} /></button>
                        <button onClick={() => quickExportPDF(j)}   title="Descargar PDF"   className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"><FileText size={14} /></button>
                        <button onClick={() => quickExportExcel(j)} title="Descargar Excel" className="p-2 rounded-lg text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"><FileSpreadsheet size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {(hasPrev || hasMore) && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
            <p className="text-xs text-slate-400">Página {currentPage} · Mostrando {offset + 1}–{offset + jornadas.length}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setOffset(o => Math.max(0, o - LIMIT))} disabled={!hasPrev || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">
                <ChevronLeft size={14} /> Anterior
              </button>
              <button onClick={() => setOffset(o => o + LIMIT)} disabled={!hasMore || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all">
                Siguiente <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <JornadaModal
          jornada={modal.jornada} resumen={modal.resumen} detalle={modal.detalle} loading={modal.loading}
          onClose={() => setModal(null)}
          onPDF={() => exportRutasJornadaDetallePDF(modal.jornada, modal.resumen?.resumen ?? null, modal.detalle?.items ?? [])}
          onExcel={() => exportRutasJornadaDetalleExcel(modal.jornada, modal.resumen?.resumen ?? null, modal.detalle?.items ?? [])}
        />
      )}
    </div>
  );
}

// ─── Admin: Modal crear ruta ──────────────────────────────────────────────────

function ModalCrearRuta({ onClose, onCreated }) {
  const [form, setForm]       = useState({ codigo: '', nombre: '', descripcion: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.codigo.trim() || !form.nombre.trim()) {
      setError('Código y nombre son obligatorios');
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await apiCreateRuta({
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || undefined,
      });
      if (res?.ok === false) throw new Error(res.message ?? res.error ?? 'Error al crear la ruta');
      onCreated();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Nueva Ruta</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 transition-all"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wide">Código <span className="text-red-400">*</span></label>
            <input
              type="text" value={form.codigo}
              onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
              placeholder="Ej: R-01"
              maxLength={20}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono uppercase"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wide">Nombre <span className="text-red-400">*</span></label>
            <input
              type="text" value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Ruta Norte - Planta A"
              maxLength={100}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1.5 block uppercase tracking-wide">Descripción <span className="text-slate-300">(opcional)</span></label>
            <textarea
              value={form.descripcion}
              onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
              placeholder="Descripción breve de la ruta..."
              rows={3} maxLength={255}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all disabled:opacity-50">
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {loading ? 'Creando...' : 'Crear Ruta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Admin: Sección gestión de rutas ─────────────────────────────────────────

function SeccionGestionRutas() {
  const [rutas,      setRutas]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [toggling,   setToggling]   = useState(null);
  const [showModal,  setShowModal]  = useState(false);
  const [filtroActivo, setFiltroActivo] = useState('todos'); // 'todos' | 'activas' | 'inactivas'

  async function loadRutas() {
    setLoading(true); setError(null);
    try {
      const res = await apiGetRutasAdminRutas();
      if (res?.ok === false) throw new Error(res.error ?? 'Error al cargar rutas');
      setRutas(res.rutas ?? []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadRutas(); }, []);

  async function handleToggle(ruta) {
    setToggling(ruta.id_ruta);
    setError(null);
    try {
      const nuevoActivo = ruta.activo ? 0 : 1;
      const res = await apiToggleRuta(ruta.id_ruta, nuevoActivo);
      if (res?.ok === false) throw new Error(res.message ?? 'Error al actualizar');
      setRutas(prev => prev.map(r => r.id_ruta === ruta.id_ruta ? { ...r, activo: nuevoActivo } : r));
    } catch (e) { setError(e.message); }
    finally { setToggling(null); }
  }

  const rutasFiltradas = rutas.filter(r => {
    if (filtroActivo === 'activas')   return !!r.activo;
    if (filtroActivo === 'inactivas') return !r.activo;
    return true;
  });

  const activas   = rutas.filter(r => !!r.activo).length;
  const inactivas = rutas.length - activas;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-slate-800">Rutas del sistema</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {rutas.length} total · <span className="text-emerald-600 font-medium">{activas} activas</span> · <span className="text-slate-400">{inactivas} inactivas</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro rápido */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { key: 'todos',     label: 'Todas' },
              { key: 'activas',   label: 'Activas' },
              { key: 'inactivas', label: 'Inactivas' },
            ].map(f => (
              <button key={f.key} onClick={() => setFiltroActivo(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${filtroActivo === f.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all shadow-sm shadow-violet-200"
          >
            <Plus size={14} /> Nueva Ruta
          </button>
          <button onClick={loadRutas} disabled={loading} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <XCircle size={15} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Lista de rutas */}
      {loading && rutas.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : rutasFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400">
          <Truck size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{rutas.length === 0 ? 'No hay rutas registradas' : 'No hay rutas con ese filtro'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rutasFiltradas.map(ruta => (
            <div key={ruta.id_ruta}
              className={`bg-white rounded-xl border p-4 flex items-center justify-between gap-4 transition-all
                ${ruta.activo ? 'border-slate-200 shadow-sm' : 'border-slate-100 opacity-70'}`}>
              <div className="flex items-center gap-4 min-w-0">
                {/* Indicador de estado */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ruta.activo ? 'bg-emerald-500 shadow-sm shadow-emerald-300' : 'bg-slate-300'}`} />
                {/* ID */}
                <span className="text-xs text-slate-400 font-mono flex-shrink-0">#{ruta.id_ruta}</span>
                {/* Código */}
                <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg flex-shrink-0 font-bold">
                  {ruta.codigo}
                </span>
                {/* Nombre + descripción */}
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{ruta.nombre}</p>
                  {ruta.descripcion && (
                    <p className="text-xs text-slate-400 truncate mt-0.5">{ruta.descripcion}</p>
                  )}
                </div>
              </div>
              {/* Toggle */}
              <button
                onClick={() => handleToggle(ruta)}
                disabled={toggling === ruta.id_ruta}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all flex-shrink-0 disabled:opacity-60
                  ${ruta.activo
                    ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
              >
                {toggling === ruta.id_ruta
                  ? <RefreshCw size={12} className="animate-spin" />
                  : <Power size={12} />
                }
                {toggling === ruta.id_ruta ? 'Guardando...' : ruta.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ModalCrearRuta
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadRutas(); }}
        />
      )}
    </div>
  );
}

// ─── Admin: Sección trabajadores sin área ─────────────────────────────────────

function SeccionTrabajadoresSinArea() {
  const today = new Date().toISOString().split('T')[0];
  const [filters,    setFilters]    = useState({ fecha: today, id_ruta: '' });
  const [applied,    setApplied]    = useState({ fecha: today, id_ruta: '' });
  const [workers,    setWorkers]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [fechaRes,   setFechaRes]   = useState('');

  // Áreas disponibles
  const [areas,      setAreas]      = useState([]);
  const [loadingAreas, setLoadingAreas] = useState(true);

  // Asignación individual: { [dni]: id_area_seleccionada }
  const [selArea,    setSelArea]    = useState({});
  // Estado de asignación por fila: { [dni]: 'loading' | 'ok' | 'error' | null }
  const [asignState, setAsignState] = useState({});

  // Asignación masiva
  const [bulkArea,   setBulkArea]   = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMsg,    setBulkMsg]    = useState(null); // { type: 'ok'|'error', text }

  // Carga áreas al montar
  useEffect(() => {
    apiGetRutasAreas()
      .then(res => setAreas(res?.items ?? []))
      .catch(() => setAreas([]))
      .finally(() => setLoadingAreas(false));
  }, []);

  const load = useCallback(async (f) => {
    setLoading(true); setError(null);
    setSelArea({}); setAsignState({}); setBulkMsg(null);
    try {
      const res = await apiGetTrabajadoresSinArea({
        fecha:   f.fecha   || undefined,
        id_ruta: f.id_ruta || undefined,
      });
      if (res?.ok === false) throw new Error(res.error ?? 'Error al cargar');
      setWorkers(res.items ?? []);
      setFechaRes(res.fecha ?? f.fecha);
    } catch (e) { setError(e.message); setWorkers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(applied); }, [applied, load]);

  function handleBuscar() { setApplied({ ...filters }); }

  // Asignación individual
  async function handleAsignarUno(dni) {
    const id_area = Number(selArea[dni]);
    if (!id_area) return;
    setAsignState(p => ({ ...p, [dni]: 'loading' }));
    try {
      const res = await apiAsignarAreaTrabajador(dni, id_area);
      if (res?.ok === false) throw new Error(res.error ?? res.message ?? 'Error');
      setAsignState(p => ({ ...p, [dni]: 'ok' }));
      // Quitar de la lista después de 800ms
      setTimeout(() => setWorkers(prev => prev.filter(w => w.dni !== dni)), 800);
    } catch (e) {
      setAsignState(p => ({ ...p, [dni]: 'error' }));
      setTimeout(() => setAsignState(p => ({ ...p, [dni]: null })), 3000);
    }
  }

  // Asignación masiva (todos los que están en la lista)
  async function handleAsignarTodos() {
    const id_area = Number(bulkArea);
    if (!id_area || workers.length === 0) return;
    setBulkLoading(true); setBulkMsg(null);
    try {
      const dnis = workers.map(w => w.dni);
      const res = await apiAsignarAreaBulk(id_area, dnis);
      if (res?.ok === false) throw new Error(res.error ?? res.message ?? 'Error');
      setBulkMsg({ type: 'ok', text: `✓ ${res.actualizados ?? dnis.length} trabajador(es) asignados correctamente` });
      // Refrescar la lista
      setTimeout(() => load(applied), 600);
    } catch (e) {
      setBulkMsg({ type: 'error', text: e.message });
    } finally {
      setBulkLoading(false);
    }
  }

  const areaSel = (dni) => areas.find(a => a.id_area === Number(selArea[dni]));

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Trabajadores sin área de trabajo asignada</p>
          <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
            Estas personas fueron escaneadas en la fecha seleccionada pero no tienen un área asignada en el sistema
            (<code className="bg-amber-100 px-1 rounded">id_area</code> es nulo). Usa el selector de área para asignarlas.
          </p>
        </div>
      </div>

      {/* Filtros de búsqueda */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Fecha</label>
            <input type="date" value={filters.fecha}
              onChange={e => setFilters(p => ({ ...p, fecha: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleBuscar()}
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">ID Ruta (opcional)</label>
            <input type="number" value={filters.id_ruta} min={1}
              onChange={e => setFilters(p => ({ ...p, id_ruta: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleBuscar()}
              placeholder="Todas las rutas"
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500 w-44" />
          </div>
          <button onClick={handleBuscar} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all disabled:opacity-50">
            <Search size={14} /> Buscar
          </button>
          {filters.id_ruta && (
            <button onClick={() => { setFilters(p => ({ ...p, id_ruta: '' })); setApplied(p => ({ ...p, id_ruta: '' })); }}
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
              <X size={12} /> Quitar filtro ruta
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <XCircle size={15} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Asignación masiva — solo cuando hay trabajadores */}
      {workers.length > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <p className="text-xs font-bold text-violet-800 uppercase tracking-wider mb-3">
            Asignación masiva — asignar el mismo área a todos los {workers.length} trabajadores de la lista
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={bulkArea}
              onChange={e => setBulkArea(e.target.value)}
              disabled={loadingAreas}
              className="px-3 py-2 text-sm border border-violet-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 min-w-[220px]"
            >
              <option value="">— Seleccionar área —</option>
              {areas.map(a => (
                <option key={a.id_area} value={a.id_area}>{a.nombre} ({a.codigo})</option>
              ))}
            </select>
            <button
              onClick={handleAsignarTodos}
              disabled={!bulkArea || bulkLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all disabled:opacity-40 shadow-sm shadow-violet-200"
            >
              {bulkLoading
                ? <><RefreshCw size={13} className="animate-spin" /> Asignando...</>
                : <><MapPin size={13} /> Asignar a todos</>
              }
            </button>
          </div>
          {bulkMsg && (
            <div className={`mt-3 flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg
              ${bulkMsg.type === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {bulkMsg.type === 'ok' ? <CheckCircle size={13} /> : <XCircle size={13} />}
              {bulkMsg.text}
            </div>
          )}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-700">
              {loading ? 'Buscando...' : `${workers.length} trabajador${workers.length !== 1 ? 'es' : ''} sin área`}
            </p>
            {fechaRes && !loading && (
              <p className="text-xs text-slate-400 mt-0.5">Fecha: {fmtFechaCorta(fechaRes)}{applied.id_ruta ? ` · Ruta #${applied.id_ruta}` : ''}</p>
            )}
          </div>
          {loading && <RefreshCw size={14} className="animate-spin text-violet-500" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['N°', 'DNI', 'Apellidos y Nombres', 'Cargo', 'Ruta', 'Origen', 'Asignar área'].map(col => (
                  <th key={col} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && workers.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : workers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <CheckCircle size={32} className="mx-auto mb-2 text-emerald-400 opacity-60" />
                    <p className="text-sm font-medium text-slate-500">¡Sin pendientes!</p>
                    <p className="text-xs mt-1 text-slate-300">Todos los trabajadores escaneados tienen área asignada</p>
                  </td>
                </tr>
              ) : (
                workers.map((w, i) => {
                  const state = asignState[w.dni];
                  const isOk  = state === 'ok';
                  const isErr = state === 'error';
                  const isBusy = state === 'loading';
                  return (
                    <tr key={w.id_trabajador}
                      className={`border-b border-slate-100 transition-colors last:border-0
                        ${isOk ? 'bg-emerald-50' : isErr ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-3 text-xs text-slate-400 font-mono">{i + 1}</td>
                      <td className="px-4 py-3 font-mono text-slate-700 text-xs">{w.dni ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 text-xs">
                        {`${(w.apellidos ?? '').toUpperCase()} ${w.nombres ?? ''}`.trim() || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{w.cargo || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {w.id_ruta
                          ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">#{w.id_ruta}</span>
                          : <span className="text-xs text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{w.origen_registro ?? '—'}</span>
                      </td>
                      <td className="px-4 py-2">
                        {isOk ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <CheckCircle size={13} /> Asignado
                          </span>
                        ) : isErr ? (
                          <span className="text-xs text-red-500 font-medium">Error — reintentar</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <select
                              value={selArea[w.dni] ?? ''}
                              onChange={e => setSelArea(p => ({ ...p, [w.dni]: e.target.value }))}
                              disabled={isBusy || loadingAreas}
                              className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-violet-400 max-w-[170px]"
                            >
                              <option value="">— Área —</option>
                              {areas.map(a => (
                                <option key={a.id_area} value={a.id_area}>{a.nombre}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAsignarUno(w.dni)}
                              disabled={!selArea[w.dni] || isBusy}
                              className="flex items-center gap-1 px-3 py-1 text-xs font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all disabled:opacity-40 whitespace-nowrap"
                            >
                              {isBusy
                                ? <RefreshCw size={11} className="animate-spin" />
                                : <MapPin size={11} />
                              }
                              Asignar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Administración (solo superadmin) ────────────────────────────────────

function TabAdminRutas() {
  const [subTab, setSubTab] = useState('rutas'); // 'rutas' | 'sinArea'

  return (
    <div className="space-y-5">
      {/* Header con badge SA */}
      <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Shield size={18} className="text-violet-600" />
        </div>
        <div>
          <p className="font-bold text-violet-800 text-sm">Zona de Administración</p>
          <p className="text-xs text-violet-500 mt-0.5">Acceso restringido · Solo superadmin</p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setSubTab('rutas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${subTab === 'rutas' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Truck size={14} /> Gestión de Rutas
        </button>
        <button
          onClick={() => setSubTab('sinArea')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${subTab === 'sinArea' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <MapPin size={14} /> Trabajadores sin Área
        </button>
      </div>

      {/* Contenido */}
      {subTab === 'rutas'   && <SeccionGestionRutas />}
      {subTab === 'sinArea' && <SeccionTrabajadoresSinArea />}
    </div>
  );
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

function TabDashboard({ data }) {
  const apiOnline      = data?.health?.status === 'ok' || data?.health?.status === 'online';
  const empresas       = data?.empresas ?? [];
  const totalEmpresas  = data?.totalEmpresas ?? 0;
  const activas        = data?.totalEmpresasActivas ?? 0;
  const totalTransport = empresas.reduce((acc, e) => acc + (e.transportistas?.length ?? 0), 0);

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-bold text-slate-700 mb-4 text-xs uppercase tracking-wider">Estado del sistema</h2>
        <div className="flex flex-wrap gap-3">
          <StatusBadge ok={apiOnline}         label="API Backend" />
          <StatusBadge ok={totalEmpresas > 0} label="Base de datos" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Empresas activas" value={activas}        color="blue"    sub={`de ${totalEmpresas} totales`} />
        <StatCard label="Transportistas"   value={totalTransport} color="emerald" sub="en todas las empresas" />
        <StatCard label="Jornadas activas" value="—"              color="violet"  sub="ver pestaña Reportes" />
        <StatCard label="Scans hoy"        value="—"              color="amber"   sub="ver pestaña Reportes" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-bold text-slate-700 mb-4 text-xs uppercase tracking-wider">Flujo de una jornada</h2>
        <div className="flex items-start gap-0 overflow-x-auto pb-2">
          {[
            { title: 'Inicio de sesión',   desc: 'Scanner selecciona ruta, turno, empresa y transportista',  icon: <ScanLine size={18} />,    color: 'blue' },
            { title: 'Escaneo de workers', desc: 'App lee QR/DNI de cada trabajador que aborda el vehículo', icon: <Users size={18} />,       color: 'emerald' },
            { title: 'Validación',         desc: 'Backend verifica ruta activa y detecta duplicados',        icon: <CheckCircle size={18} />, color: 'violet' },
            { title: 'Cierre de jornada',  desc: 'Scanner confirma jornada; queda disponible para reportes', icon: <Truck size={18} />,       color: 'amber' },
          ].map((step, i, arr) => (
            <div key={step.title} className="flex items-start gap-0 flex-shrink-0">
              <div className="flex flex-col items-center w-44">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3
                  ${step.color === 'blue'    ? 'bg-blue-100 text-blue-600'       : ''}
                  ${step.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : ''}
                  ${step.color === 'violet'  ? 'bg-violet-100 text-violet-600'   : ''}
                  ${step.color === 'amber'   ? 'bg-amber-100 text-amber-600'     : ''}
                `}>{step.icon}</div>
                <p className="text-xs font-bold text-slate-700 text-center mb-1">{step.title}</p>
                <p className="text-[11px] text-slate-400 text-center leading-relaxed">{step.desc}</p>
              </div>
              {i < arr.length - 1 && (
                <div className="flex items-center mt-4 mx-1 flex-shrink-0">
                  <div className="w-8 h-0.5 bg-slate-200" />
                  <div className="w-0 h-0 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="font-bold text-slate-700 mb-4 text-xs uppercase tracking-wider">Empresas de transporte ({totalEmpresas})</h2>
        {empresas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
            <Truck size={36} className="mx-auto mb-3 opacity-30" />
            <p>No se encontraron empresas de transporte</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {empresas.map(emp => <EmpresaCard key={emp.id_empresa_transporte} empresa={emp} />)}
          </div>
        )}
      </div>
      <div className="bg-slate-900 rounded-2xl p-6 text-slate-400 text-sm">
        <div className="flex items-center gap-2 mb-3">
          <Database size={16} className="text-slate-500" />
          <span className="font-bold text-white text-xs uppercase tracking-wider">Stack técnico</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div><span className="text-slate-500">Mobile</span><p className="text-white font-medium mt-0.5">Flutter (Android/iOS)</p></div>
          <div><span className="text-slate-500">Backend</span><p className="text-white font-medium mt-0.5">Node.js + Express</p></div>
          <div><span className="text-slate-500">Base de datos</span><p className="text-white font-medium mt-0.5">MySQL (Docker)</p></div>
          <div><span className="text-slate-500">Roles</span><p className="text-white font-medium mt-0.5">ADMIN / SCANNER</p></div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Trabajadores (solo superadmin) ─────────────────────────────────────

function TabTrabajadores() {
  const [trabajadores, setTrabajadores] = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [total,        setTotal]        = useState(0);

  // Filtros — el backend soporta: id_area, id_ruta, con_ruta
  const [idArea,   setIdArea]   = useState('');
  const [idRuta,   setIdRuta]   = useState('');
  const [conRuta,  setConRuta]  = useState(false); // solo trabajadores con ruta asignada

  // Datos para los selects
  const [areas, setAreas] = useState([]);
  const [rutas, setRutas] = useState([]);

  // Cargar áreas y rutas al montar
  useEffect(() => {
    apiGetRutasAreas()
      .then(res => setAreas(res?.items ?? []))
      .catch(() => setAreas([]));
    apiGetRutasAdminRutas()
      .then(res => setRutas(res?.rutas ?? res?.data ?? []))
      .catch(() => setRutas([]));
  }, []);

  // Cargar trabajadores — el backend devuelve TODOS (sin paginación)
  const fetchTrabajadores = useCallback(async ({ id_area, id_ruta, con_ruta } = {}) => {
    setLoading(true); setError(null);
    try {
      const res = await apiGetRutasTrabajadores({
        id_area:  id_area  || undefined,
        id_ruta:  id_ruta  || undefined,
        con_ruta: con_ruta ? '1' : undefined,
      });
      if (res?.ok === false || res?.error) {
        setError(res.error ?? res.message ?? 'Error al cargar trabajadores');
        setTrabajadores([]); setTotal(0);
        return;
      }
      // El backend devuelve { ok, total, items }
      const items = res?.items ?? res?.trabajadores ?? res?.data ?? (Array.isArray(res) ? res : []);
      setTrabajadores(items);
      setTotal(res?.total ?? items.length);
    } catch (e) { setError(e.message); setTrabajadores([]); setTotal(0); }
    finally { setLoading(false); }
  }, []);

  // Recargar cuando cambian los filtros
  useEffect(() => {
    fetchTrabajadores({ id_area: idArea, id_ruta: idRuta, con_ruta: conRuta });
  }, [idArea, idRuta, conRuta, fetchTrabajadores]);

  function handleLimpiar() {
    setIdArea(''); setIdRuta(''); setConRuta(false);
  }

  const hayFiltros = idArea || idRuta || conRuta;

  return (
    <div className="space-y-6">
      {/* Header con badge SA */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <UserCheck size={18} className="text-blue-600" />
        </div>
        <div>
          <p className="font-bold text-blue-800 text-sm">Directorio de Trabajadores</p>
          <p className="text-xs text-blue-500 mt-0.5">Acceso restringido · Solo superadmin · Consulta de área y ruta asignada</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-4">Filtros</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
          {/* Área */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Área</label>
            <select value={idArea} onChange={e => setIdArea(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas las áreas</option>
              {areas.map(a => (
                <option key={a.id_area} value={a.id_area}>{a.nombre} ({a.codigo})</option>
              ))}
            </select>
          </div>
          {/* Ruta */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Ruta</label>
            <select value={idRuta} onChange={e => setIdRuta(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas las rutas</option>
              {rutas.map(r => (
                <option key={r.id_ruta} value={r.id_ruta}>{r.nombre} ({r.codigo})</option>
              ))}
            </select>
          </div>
          {/* Solo con ruta asignada */}
          <div className="flex items-center gap-3 pb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={conRuta}
                onChange={e => setConRuta(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-600">Solo con ruta asignada</span>
            </label>
          </div>
        </div>
        {hayFiltros && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <button onClick={handleLimpiar} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50">
              <X size={14} /> Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <XCircle size={18} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-700 text-sm">Error al cargar trabajadores</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <p className="text-sm text-slate-500">
            {loading
              ? 'Cargando trabajadores...'
              : total === 0
                ? 'Sin resultados'
                : `${desde}–${hasta} de ${total} trabajador${total !== 1 ? 'es' : ''}`
            }
          </p>
          {loading && <RefreshCw size={14} className="animate-spin text-blue-500" />}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {['DNI', 'Nombre completo', 'Área', 'Código área', 'Ruta', 'Estado área'].map(col => (
                  <th key={col} className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && trabajadores.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-200 rounded animate-pulse" style={{ width: `${55 + (j * 9) % 35}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : trabajadores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center text-slate-400">
                    <Users size={36} className="mx-auto mb-3 opacity-25" />
                    <p className="text-sm font-medium">No se encontraron trabajadores</p>
                    <p className="text-xs mt-1 text-slate-300">Ajusta los filtros o verifica la conexión con el backend</p>
                  </td>
                </tr>
              ) : (
                trabajadores.map((trab, i) => {
                  const nombreCompleto = `${(trab.apellidos ?? '').toUpperCase()} ${trab.nombres ?? ''}`.trim() || '—';
                  const nombreArea     = trab.area ?? trab.nombre_area ?? trab.area_nombre ?? null;
                  const codigoArea     = trab.codigo_area ?? trab.area_codigo ?? null;
                  const nombreRuta     = trab.ruta ?? trab.nombre_ruta ?? trab.ruta_nombre ?? null;
                  const tieneArea      = nombreArea !== null;

                  return (
                    <tr key={trab.id_trabajador ?? trab.dni ?? i}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-0">
                      <td className="px-4 py-3 font-mono text-slate-700 text-xs">{trab.dni ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{nombreCompleto}</td>
                      <td className="px-4 py-3">
                        {tieneArea
                          ? <span className="text-sm text-slate-700">{nombreArea}</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Sin área</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {codigoArea
                          ? <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg font-bold">{codigoArea}</span>
                          : <span className="text-xs text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {nombreRuta
                          ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{nombreRuta}</span>
                          : <span className="text-xs text-slate-400 italic">Sin ruta</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {tieneArea
                          ? <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold">Con área</span>
                          : <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-semibold">Sin área</span>
                        }
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Total — el backend devuelve todos los resultados sin paginación */}
        {!loading && total > 0 && (
          <div className="px-6 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-400">{total} trabajador{total !== 1 ? 'es' : ''} encontrado{total !== 1 ? 's' : ''}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function RutasPage() {
  const { user }     = useAuth();
  const isSuperadmin = user?.role === 'superadmin';

  const [activeTab,  setActiveTab]  = useState('dashboard');
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  async function fetchData() {
    setLoading(true); setError(null);
    try {
      const res = await apiGetRutasDashboard();
      setData(res);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'dashboard',    label: 'Dashboard',       icon: <LayoutDashboard size={15} /> },
    { id: 'reportes',     label: 'Reportes',         icon: <BarChart2 size={15} /> },
    ...(isSuperadmin ? [
      { id: 'trabajadores', label: 'Trabajadores',   icon: <UserCheck size={15} />, badge: 'SA' },
      { id: 'admin',        label: 'Administración', icon: <Shield size={15} />,    badge: 'SA' },
    ] : []),
  ];

  return (
    <Layout
      title="Rutas Trabunda"
      subtitle={lastUpdate ? `Actualizado: ${lastUpdate}` : 'App móvil de control de acceso y transporte'}
    >
      <div className="space-y-6 max-w-[1200px]">

        {/* Barra superior */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${activeTab === tab.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {tab.icon}
                {tab.label}
                {tab.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded-full font-bold leading-none">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
          </button>
        </div>

        {data && !data.configured && <NotConfigured />}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
            <XCircle size={20} className="text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-700">Error de conexión</p>
              <p className="text-sm text-red-500">{error}</p>
            </div>
          </div>
        )}

        {loading && !data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-28 animate-pulse" />
            ))}
          </div>
        )}

        {/* Tab: Reportes siempre accesible */}
        {activeTab === 'reportes' && <TabReportesRutas />}

        {/* Tab: Trabajadores solo para superadmin */}
        {activeTab === 'trabajadores' && isSuperadmin && <TabTrabajadores />}

        {/* Tab: Admin siempre accesible para superadmin (gestiona su propio estado) */}
        {activeTab === 'admin' && isSuperadmin && <TabAdminRutas />}

        {/* Tab: Dashboard solo cuando el backend está configurado */}
        {activeTab === 'dashboard' && data?.configured && <TabDashboard data={data} />}
      </div>
    </Layout>
  );
}
