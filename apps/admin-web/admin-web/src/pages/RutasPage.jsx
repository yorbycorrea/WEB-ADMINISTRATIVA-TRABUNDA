import { useState, useEffect } from 'react';
import { RefreshCw, Truck, Users, ScanLine, CheckCircle, XCircle, AlertCircle, Database } from 'lucide-react';
import Layout from '../components/Layout';
import { apiGetRutasDashboard } from '../api/gateway';

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:    'text-blue-600',
    emerald: 'text-emerald-600',
    violet:  'text-violet-600',
    amber:   'text-amber-600',
  };
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

// Card de empresa de transporte con sus transportistas
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

      {/* Lista de transportistas */}
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

export default function RutasPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetRutasDashboard();
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
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, []);

  const apiOnline       = data?.health?.status === 'ok' || data?.health?.status === 'online';
  const empresas        = data?.empresas ?? [];
  const totalEmpresas   = data?.totalEmpresas ?? 0;
  const activas         = data?.totalEmpresasActivas ?? 0;
  const totalTransport  = empresas.reduce((acc, e) => acc + (e.transportistas?.length ?? 0), 0);

  return (
    <Layout
      title="Rutas Trabunda"
      subtitle={lastUpdate ? `Actualizado: ${lastUpdate}` : 'App móvil de control de acceso y transporte'}
    >
      <div className="space-y-8 max-w-[1200px]">

        {/* Refresh */}
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

        {data?.configured && (
          <>
            {/* Estado */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Estado del sistema</h2>
              <div className="flex flex-wrap gap-3">
                <StatusBadge ok={apiOnline}       label="API Backend" />
                <StatusBadge ok={totalEmpresas > 0} label="Base de datos" />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard label="Empresas activas"  value={activas}         color="blue"    sub={`de ${totalEmpresas} totales`} />
              <StatCard label="Transportistas"     value={totalTransport}  color="emerald" sub="en todas las empresas" />
              <StatCard label="Jornadas activas"   value="—"              color="violet"  sub="requiere configuración" />
              <StatCard label="Scans hoy"          value="—"              color="amber"   sub="requiere configuración" />
            </div>

            {/* Cómo funciona el flujo de escaneo */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Flujo de una jornada</h2>
              <div className="flex items-start gap-0 overflow-x-auto pb-2">
                {[
                  { num: '1', title: 'Inicio de sesión',    desc: 'Scanner selecciona ruta, turno, empresa y transportista',  icon: <ScanLine size={18}/>,  color: 'blue' },
                  { num: '2', title: 'Escaneo de workers', desc: 'App lee QR/DNI de cada trabajador que aborda el vehículo', icon: <Users size={18}/>,    color: 'emerald' },
                  { num: '3', title: 'Validación',          desc: 'Backend verifica ruta activa y detecta trabajadores duplicados', icon: <CheckCircle size={18}/>, color: 'violet' },
                  { num: '4', title: 'Cierre de jornada',  desc: 'Scanner confirma jornada; queda disponible para reportes', icon: <Truck size={18}/>,    color: 'amber' },
                ].map((step, i, arr) => (
                  <div key={step.num} className="flex items-start gap-0 flex-shrink-0">
                    <div className="flex flex-col items-center w-44">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3
                        ${step.color === 'blue'    ? 'bg-blue-100 text-blue-600'    : ''}
                        ${step.color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : ''}
                        ${step.color === 'violet'  ? 'bg-violet-100 text-violet-600'  : ''}
                        ${step.color === 'amber'   ? 'bg-amber-100 text-amber-600'   : ''}
                      `}>
                        {step.icon}
                      </div>
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

            {/* Empresas de transporte */}
            <div>
              <h2 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">
                Empresas de transporte ({totalEmpresas})
              </h2>
              {empresas.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400">
                  <Truck size={36} className="mx-auto mb-3 opacity-30" />
                  <p>No se encontraron empresas de transporte</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {empresas.map(emp => (
                    <EmpresaCard key={emp.id_empresa_transporte} empresa={emp} />
                  ))}
                </div>
              )}
            </div>

            {/* Info técnica */}
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
          </>
        )}
      </div>
    </Layout>
  );
}
