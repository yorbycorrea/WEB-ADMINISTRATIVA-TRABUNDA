import { useEffect, useState } from 'react';
import {
  AlertCircle, CheckCircle, ClipboardList, Download, Eye, PackageCheck,
  RefreshCw, Search, ShieldCheck, UserCheck, X, XCircle,
} from 'lucide-react';
import Layout from '../components/Layout';
import {
  apiGetGuantesDashboard,
  apiGetGuantesRequerimientos,
  apiGetGuantesRequerimientoDetalle,
  apiGetGuantesSalidasAlmacen,
  apiGetGuantesRequeridoVsEntregado,
} from '../api/gateway';

const ESTADOS = [
  { key: '', label: 'Todos' },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'despachado', label: 'Despachado' },
  { key: 'en_lavanderia', label: 'En lavandería' },
  { key: 'entregando', label: 'Entregando' },
  { key: 'completado', label: 'Completado' },
  { key: 'cerrado', label: 'Cerrado' },
  { key: 'cancelado', label: 'Cancelado' },
];

const ESTADO_STYLES = {
  pendiente: 'bg-amber-100 text-amber-700',
  despachado: 'bg-blue-100 text-blue-700',
  en_lavanderia: 'bg-cyan-100 text-cyan-700',
  entregando: 'bg-violet-100 text-violet-700',
  completado: 'bg-emerald-100 text-emerald-700',
  cerrado: 'bg-slate-100 text-slate-600',
  cancelado: 'bg-red-100 text-red-600',
};

function hoy() {
  return new Date().toISOString().split('T')[0];
}

function haceDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().split('T')[0];
}

function fmtFecha(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

function nombreEstado(estado) {
  return ESTADOS.find(e => e.key === estado)?.label ?? estado ?? '-';
}

function EstadoBadge({ estado }) {
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${ESTADO_STYLES[estado] ?? 'bg-slate-100 text-slate-600'}`}>
      {nombreEstado(estado)}
    </span>
  );
}

function NotConfigured() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 max-w-xl">
      <AlertCircle size={34} className="text-amber-500 mb-4" />
      <h2 className="text-lg font-bold text-slate-800">Backend de Guantes no configurado</h2>
      <p className="text-sm text-slate-500 mt-2 leading-relaxed">
        Agrega estas variables al `.env` del AdminSuite y reinicia el gateway.
      </p>
      <pre className="mt-4 bg-slate-900 text-emerald-300 rounded-xl p-4 text-xs overflow-x-auto">
{`GUANTES_BACKEND_URL=http://servidor-glovtrack:3000
GUANTES_ADMIN_DNI=76134951
GUANTES_ADMIN_PASS=tu_password`}
      </pre>
      <p className="text-xs text-amber-700 mt-3">
        Usa un usuario de rol almacén o lavandería para que pueda ver todos los requerimientos.
      </p>
    </div>
  );
}

function Stat({ icon, label, value, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value ?? '-'}</p>
          {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          {icon}
        </div>
      </div>
    </div>
  );
}

function TabResumen({ data, loading, onRefresh }) {
  const req = data?.requerimientos;
  const inv = Array.isArray(data?.inventario) ? data.inventario : [];
  const porEstado = req?.porEstado ?? {};
  const stockBajo = inv.filter(i => Number(i.stock_actual) <= Number(i.stock_minimo)).length;

  if (loading && !data) {
    return <div className="h-48 bg-white border border-slate-200 rounded-2xl animate-pulse" />;
  }

  if (!data?.configured) return <NotConfigured />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={onRefresh} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <Stat icon={<ClipboardList size={20} />} label="Requerimientos" value={req?.total ?? 0} sub="últimos registros visibles" />
        <Stat icon={<PackageCheck size={20} />} label="Completados" value={porEstado.completado ?? 0} sub="entregados al 100%" />
        <Stat icon={<UserCheck size={20} />} label="Pendientes entrega" value={req?.pendientesEntrega ?? 0} sub="trabajadores aún sin recibir" />
        <Stat icon={<AlertCircle size={20} />} label="Stock bajo" value={stockBajo} sub="ítems bajo mínimo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">Estados de requerimientos</h2>
          </div>
          <div className="p-6 grid grid-cols-2 gap-3">
            {ESTADOS.filter(e => e.key).map(e => (
              <div key={e.key} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                <EstadoBadge estado={e.key} />
                <span className="font-bold text-slate-700">{porEstado[e.key] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">Inventario actual</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Mínimo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inv.map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium text-slate-700">{item.descripcion || item.tipo_guante}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{item.stock_actual}</td>
                    <td className="px-4 py-3 text-slate-500">{item.stock_minimo}</td>
                  </tr>
                ))}
                {inv.length === 0 && (
                  <tr><td colSpan="3" className="px-4 py-8 text-center text-slate-400">Sin inventario disponible</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetalleModal({ id, onClose }) {
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    apiGetGuantesRequerimientoDetalle(id)
      .then(data => { if (mounted) setDetalle(data); })
      .catch(e => { if (mounted) setError(e.message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Detalle del requerimiento</h2>
            <p className="text-xs text-slate-400">{detalle?.codigo ?? `#${id}`}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400"><RefreshCw className="animate-spin mx-auto mb-3" />Cargando detalle...</div>
        ) : error ? (
          <div className="p-10 text-center text-red-500">{error}</div>
        ) : (
          <div className="overflow-y-auto">
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-slate-100">
              <div><p className="text-xs text-slate-400 font-bold uppercase">Estado</p><div className="mt-1"><EstadoBadge estado={detalle.estado} /></div></div>
              <div><p className="text-xs text-slate-400 font-bold uppercase">Solicitado por</p><p className="text-sm font-semibold text-slate-700 mt-1">{detalle.solicitado_por ?? '-'}</p></div>
              <div><p className="text-xs text-slate-400 font-bold uppercase">Despachado por</p><p className="text-sm font-semibold text-slate-700 mt-1">{detalle.despachado_por ?? '-'}</p></div>
              <div><p className="text-xs text-slate-400 font-bold uppercase">Recibido por</p><p className="text-sm font-semibold text-slate-700 mt-1">{detalle.recibido_por ?? '-'}</p></div>
              <div><p className="text-xs text-slate-400 font-bold uppercase">Área</p><p className="text-sm font-semibold text-slate-700 mt-1">{detalle.area_nombre ?? '-'}</p></div>
              <div><p className="text-xs text-slate-400 font-bold uppercase">Turno</p><p className="text-sm font-semibold text-slate-700 mt-1">{detalle.turno ?? '-'}</p></div>
              <div><p className="text-xs text-slate-400 font-bold uppercase">Despacho</p><p className="text-sm text-slate-600 mt-1">{fmtFecha(detalle.fecha_despacho)}</p></div>
              <div><p className="text-xs text-slate-400 font-bold uppercase">Recepción</p><p className="text-sm text-slate-600 mt-1">{fmtFecha(detalle.fecha_recepcion)}</p></div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {['Trabajador', 'Código', 'Guante', 'Mangas', 'Estado', 'Entregado por', 'Fecha entrega'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detalle.trabajadores ?? []).map(t => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-800">{t.trabajador}</td>
                      <td className="px-4 py-3 text-slate-500">{t.codigo ?? '-'}</td>
                      <td className="px-4 py-3">{t.talla_guante ? `Talla ${t.talla_guante}` : '-'}</td>
                      <td className="px-4 py-3">{t.lleva_mangas ? 'Sí' : 'No'}</td>
                      <td className="px-4 py-3">
                        {t.entregado ? <span className="text-emerald-600 font-semibold">Entregado</span> : t.no_recogio ? <span className="text-amber-600 font-semibold">No recogió</span> : <span className="text-slate-400">Pendiente</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{t.entregado_por_nombre_completo ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtFecha(t.fecha_entrega)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabRequerimientos() {
  const [fecha, setFecha] = useState(hoy());
  const [estado, setEstado] = useState('');
  const [turno, setTurno] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detalleId, setDetalleId] = useState(null);

  async function cargar(e) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetGuantesRequerimientos({ fecha, estado, turno, q, limit: 100 });
      setItems(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      {detalleId && <DetalleModal id={detalleId} onClose={() => setDetalleId(null)} />}

      <form onSubmit={cargar} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase">Estado</label>
            <select value={estado} onChange={e => setEstado(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none">
              {ESTADOS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase">Turno</label>
            <select value={turno} onChange={e => setTurno(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white outline-none">
              <option value="">Todos</option>
              <option value="dia">Día</option>
              <option value="noche">Noche</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-[220px]">
            <label className="text-xs font-bold text-slate-400 uppercase">Buscar</label>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Código, área, creador, despachador..."
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          <button disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
            <Search size={14} /> Buscar
          </button>
        </div>
      </form>

      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between">
          <div>
            <p className="font-semibold text-slate-800">{loading ? 'Cargando...' : `${total} requerimientos encontrados`}</p>
            <p className="text-xs text-slate-400">{fecha || 'Todas las fechas'}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['Código', 'Estado', 'Área', 'Turno', 'Solicitado por', 'Despachado por', 'Recibido por', 'Entrega', 'Creado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="10" className="px-4 py-10 text-center text-slate-400">Cargando...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan="10" className="px-4 py-10 text-center text-slate-400">Sin requerimientos para esta búsqueda</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-800">{item.codigo}</td>
                  <td className="px-4 py-3"><EstadoBadge estado={item.estado} /></td>
                  <td className="px-4 py-3 text-slate-600">{item.area_nombre ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize">{item.turno ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-700">{item.solicitado_por ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.despachado_por ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{item.recibido_por ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-700">{item.progreso_entrega?.entregados ?? 0}</span>
                    <span className="text-slate-400">/{item.progreso_entrega?.total ?? 0}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmtFecha(item.fecha_requerimiento)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setDetalleId(item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold hover:bg-blue-100">
                      <Eye size={13} /> Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TabReportes() {
  const [desde, setDesde] = useState(haceDias(7));
  const [hasta, setHasta] = useState(hoy());
  const [salidas, setSalidas] = useState([]);
  const [comparativo, setComparativo] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function cargar(e) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const [s, c] = await Promise.all([
        apiGetGuantesSalidasAlmacen({ desde, hasta }),
        apiGetGuantesRequeridoVsEntregado({ desde, hasta }),
      ]);
      setSalidas(s?.filas ?? []);
      setComparativo(c?.filas ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      <form onSubmit={cargar} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-400 uppercase">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm" />
        </div>
        <button disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>
      </form>

      {error && <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ReporteTabla
          title="Salidas de almacén"
          icon={<Download size={16} />}
          rows={salidas}
          columns={['fecha', 'turno', 'requerido_por', 'area', 'mangas', 'guantes_l', 'guantes_m', 'guantes_s', 'total_guantes']}
        />
        <ReporteTabla
          title="Requerido vs entregado"
          icon={<CheckCircle size={16} />}
          rows={comparativo}
          columns={['codigo', 'area', 'estado', 'solicitado', 'trabajadores', 'entregados', 'cantidad_entregada', 'no_recogieron']}
        />
      </div>
    </div>
  );
}

function ReporteTabla({ title, icon, rows, columns }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <span className="text-blue-600">{icon}</span>
        <h2 className="font-bold text-slate-800">{title}</h2>
      </div>
      <div className="overflow-x-auto max-h-[460px]">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              {columns.map(c => <th key={c} className="px-3 py-3 text-left font-bold text-slate-400 uppercase whitespace-nowrap">{c.replaceAll('_', ' ')}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">Sin datos</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {columns.map(c => <td key={c} className="px-3 py-2 text-slate-600 whitespace-nowrap">{String(row[c] ?? '-')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GuantesPage() {
  const [tab, setTab] = useState('resumen');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  async function cargarDashboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetGuantesDashboard();
      setData(res);
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDashboard();
    const interval = setInterval(cargarDashboard, 60_000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'requerimientos', label: 'Requerimientos' },
    { id: 'reportes', label: 'Reportes' },
  ];

  return (
    <Layout
      title="Guantes"
      subtitle={lastUpdate ? `Actualizado: ${lastUpdate}` : 'Monitoreo de requerimientos, despacho y entregas'}
    >
      <div className="space-y-6 max-w-[1320px]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={14} />
            Trazabilidad desde GlovTrack
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
            <XCircle size={20} className="text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-700">Error de conexión</p>
              <p className="text-sm text-red-500">{error}</p>
            </div>
          </div>
        )}

        {tab === 'resumen' && <TabResumen data={data} loading={loading} onRefresh={cargarDashboard} />}
        {tab === 'requerimientos' && <TabRequerimientos />}
        {tab === 'reportes' && <TabReportes />}
      </div>
    </Layout>
  );
}
