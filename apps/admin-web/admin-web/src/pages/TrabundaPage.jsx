import { useState, useEffect } from 'react';
import { RefreshCw, Clock, Users, FileText, CheckCircle, XCircle, AlertCircle, Database } from 'lucide-react';
import Layout from '../components/Layout';
import { apiGetTrabundaDashboard } from '../api/gateway';

// Los 4 módulos operativos de Trabunda
const MODULOS = [
  {
    tipo: 'APOYO_HORAS',
    label: 'Apoyo Horas',
    descripcion: 'Registro de horas trabajadas por operario con hora inicio y fin.',
    color: 'blue',
    icon: <Clock size={22} />,
  },
  {
    tipo: 'SANEAMIENTO',
    label: 'Saneamiento',
    descripcion: 'Reportes de limpieza e higiene por área y turno.',
    color: 'emerald',
    icon: <CheckCircle size={22} />,
  },
  {
    tipo: 'TRABAJO_AVANCE',
    label: 'Trabajo Avance',
    descripcion: 'Cuadrillas de recepción/fileteado con producción en kg.',
    color: 'violet',
    icon: <Users size={22} />,
  },
  {
    tipo: 'CONTEO_RAPIDO',
    label: 'Conteo Rápido',
    descripcion: 'Conteo de personal por área en tiempo real.',
    color: 'amber',
    icon: <FileText size={22} />,
  },
];

const colorMap = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700'   },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600',badge: 'bg-emerald-100 text-emerald-700' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600', badge: 'bg-violet-100 text-violet-700' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700'  },
};

function StatCard({ label, value, sub, color = 'blue' }) {
  const c = colorMap[color];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${c.text}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function ModuloCard({ modulo, count }) {
  const c = colorMap[modulo.color];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${c.bg} ${c.text}`}>
          {modulo.icon}
        </div>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.badge}`}>
          {count ?? 0} hoy
        </span>
      </div>
      <h3 className="font-bold text-slate-800 mb-1">{modulo.label}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{modulo.descripcion}</p>
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

// Cuando el backend no está configurado, mostramos instrucciones
function NotConfigured() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center max-w-lg mx-auto mt-10">
      <AlertCircle size={40} className="text-amber-500 mx-auto mb-4" />
      <h3 className="font-bold text-slate-800 text-lg mb-2">Backend no configurado</h3>
      <p className="text-slate-500 text-sm leading-relaxed mb-4">
        Configura las variables de entorno en el archivo <code className="bg-amber-100 px-1 rounded">.env</code> del Admin Suite:
      </p>
      <pre className="text-left bg-slate-900 text-emerald-400 text-xs rounded-xl p-4 overflow-x-auto">
{`TRABUNDA_BACKEND_URL=http://tu-servidor:puerto
TRABUNDA_ADMIN_USER=admin
TRABUNDA_ADMIN_PASS=tu_password`}
      </pre>
      <p className="text-slate-400 text-xs mt-3">Reinicia el Gateway después de editar el .env</p>
    </div>
  );
}

export default function TrabundaPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  async function fetchData() {
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
    fetchData();
    const interval = setInterval(fetchData, 60_000); // refresca cada minuto
    return () => clearInterval(interval);
  }, []);

  // ── Derivamos los datos que necesitamos del response ─────────────────────
  // Si el gateway pudo obtener respuesta del endpoint (no es null),
  // el servicio está online — no dependemos del formato exacto del body.
  // null significa que el fetch falló (red caída, 5xx, timeout).
  const apiOnline     = data?.health != null;
  const workersOnline = data?.healthWorkers != null;
  const areasActivas   = (data?.areas?.areas ?? data?.areas?.data ?? []).filter(a => a.activo !== 0).length;
  const totalAreas     = (data?.areas?.areas ?? data?.areas?.data ?? []).length;
  const totalReportes  = data?.reportesHoy?.total ?? 0;
  const reportesPorTipo = data?.reportesHoy?.porTipo ?? {};
  const totalUsuarios  = (data?.usuarios?.users ?? data?.usuarios?.data ?? []).length;

  return (
    <Layout
      title="Trabunda"
      subtitle={lastUpdate ? `Actualizado: ${lastUpdate}` : 'App móvil de gestión operativa'}
    >
      <div className="space-y-8 max-w-[1200px]">

        {/* Botón de refresh */}
        <div className="flex justify-end">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
        </div>

        {/* No configurado */}
        {data && !data.configured && <NotConfigured />}

        {/* Error de conexión */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
            <XCircle size={20} className="text-red-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-700">Error de conexión</p>
              <p className="text-sm text-red-500">{error}</p>
            </div>
          </div>
        )}

        {/* Skeleton mientras carga */}
        {loading && !data && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-28 animate-pulse" />
            ))}
          </div>
        )}

        {data?.configured && (
          <>
            {/* ── Estado del sistema ───────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Estado del sistema</h2>
              <div className="flex flex-wrap gap-3">
                <StatusBadge ok={apiOnline}     label="API Backend" />
                <StatusBadge ok={workersOnline} label="Servicio Workers (GraphQL)" />
                <StatusBadge ok={!!data?.areas} label="Base de datos" />
              </div>
            </div>

            {/* ── Stats del día ────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard label="Reportes hoy"   value={totalReportes}  color="blue"    sub="todos los tipos" />
              <StatCard label="Áreas activas"  value={areasActivas}   color="emerald" sub={`de ${totalAreas} totales`} />
              <StatCard label="Usuarios"        value={totalUsuarios}  color="violet"  sub="planilleros y admin" />
              <StatCard label="Pendientes"
                value={(reportesPorTipo['APOYO_HORAS'] || 0) + (reportesPorTipo['SANEAMIENTO'] || 0)}
                color="amber"
                sub="apoyo horas + saneamiento"
              />
            </div>

            {/* ── Módulos operativos ───────────────────────────────────── */}
            <div>
              <h2 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Módulos operativos</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {MODULOS.map(m => (
                  <ModuloCard key={m.tipo} modulo={m} count={reportesPorTipo[m.tipo]} />
                ))}
              </div>
            </div>

            {/* ── Áreas ───────────────────────────────────────────────── */}
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
                        <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Área</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Apoyo Horas</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Conteo Rápido</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Trab. Avance</th>
                        <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.areas?.areas ?? data.areas?.data ?? []).slice(0, 15).map((area, i) => (
                        <tr key={area.id ?? i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-3 font-medium text-slate-800">{area.nombre}</td>
                          <td className="px-6 py-3">
                            {area.es_apoyo_horas ? <span className="text-emerald-500">✓</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-6 py-3">
                            {area.es_conteo_rapido ? <span className="text-emerald-500">✓</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-6 py-3">
                            {area.es_trabajo_avance ? <span className="text-emerald-500">✓</span> : <span className="text-slate-300">—</span>}
                          </td>
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

            {/* ── Info técnica ─────────────────────────────────────────── */}
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
          </>
        )}
      </div>
    </Layout>
  );
}
