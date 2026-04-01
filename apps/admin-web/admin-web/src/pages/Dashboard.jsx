import { useState, useEffect } from 'react';
import { Server, Power, MoreVertical, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Layout from '../components/Layout';
import { apiGetServicesHealth } from '../api/gateway';

const trafficData = [
  { hora: '00:00', requests: 40 },
  { hora: '04:00', requests: 30 },
  { hora: '08:00', requests: 85 },
  { hora: '12:00', requests: 45 },
  { hora: '16:00', requests: 90 },
  { hora: '20:00', requests: 70 },
  { hora: '23:59', requests: 55 },
];

function ServiceCard({ service }) {
  const isOnline = service.status === 'online';
  const d = service.data || {};
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isOnline ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            <Server size={20} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 capitalize">{service.name}</h4>
            <span className="text-xs text-slate-400 font-medium">Puerto: {d.port ?? '—'}</span>
          </div>
        </div>
        <button className="text-slate-400 hover:text-slate-600"><MoreVertical size={18} /></button>
      </div>
      <div className="grid grid-cols-2 gap-4 my-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Status</p>
          <p className={`text-sm font-semibold ${isOnline ? 'text-emerald-500' : 'text-red-500'}`}>
            ● {isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Uptime</p>
          <p className="text-sm font-semibold text-slate-700">{d.uptime ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">CPU</p>
          <p className="text-sm font-semibold text-slate-700">{d.cpu ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Requests</p>
          <p className="text-sm font-semibold text-slate-700">{d.requests ?? '—'}</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
        <span className="text-[11px] font-bold text-slate-400">Mem: {d.memory ?? '—'}</span>
        <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-all">
          <Power size={12} /> Restart
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [services, setServices]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  async function fetchHealth() {
    setLoading(true);
    try {
      const data = await apiGetServicesHealth();
      if (data?.services) {
        setServices(data.services);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, []);

  const onlineCount = services.filter(s => s.status === 'online').length;

  return (
    <Layout
      title="System Dashboard"
      subtitle={lastUpdate ? `Actualizado: ${lastUpdate} · ${onlineCount}/${services.length} servicios online` : 'Cargando...'}
    >
      <div className="space-y-8 max-w-[1200px]">

        {/* Tarjetas de servicios internos */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-700">Servicios internos</h2>
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading && services.length === 0
              ? Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 animate-pulse h-48" />
                ))
              : services.map(s => <ServiceCard key={s.name} service={s} />)
            }
            <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-5 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group text-slate-400 min-h-[200px]">
              <div className="p-3 rounded-full bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 mb-2">
                <Server size={24} />
              </div>
              <span className="font-bold text-sm">Agregar servicio</span>
            </div>
          </div>
        </div>

        {/* Gráfica de tráfico */}
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-lg font-bold">Traffic Monitoring</h3>
              <p className="text-sm text-slate-400 font-medium">Requests en las últimas 24 horas</p>
            </div>
            <select className="bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-2 font-medium outline-none focus:ring-2 ring-blue-500/20">
              <option>Últimas 24 horas</option>
              <option>Últimos 7 días</option>
            </select>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hora"     axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis                    axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorReq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </Layout>
  );
}
