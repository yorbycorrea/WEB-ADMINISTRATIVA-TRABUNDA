import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  Server, 
  Activity, 
  Power, 
  MoreVertical,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// Datos para la gráfica de actividad
const chartData = [
  { name: '00:00', app1: 40, app2: 24 },
  { name: '04:00', app1: 30, app2: 13 },
  { name: '08:00', app1: 85, app2: 98 },
  { name: '12:00', app1: 45, app2: 39 },
  { name: '16:00', app1: 90, app2: 48 },
  { name: '20:00', app1: 70, app2: 38 },
];

const AppStatusCard = ({ name, status, uptime, requests }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${status === 'Online' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          <Server size={20} />
        </div>
        <div>
          <h4 className="font-bold text-slate-800">{name}</h4>
          <span className="text-xs text-slate-400 font-medium">Port: 8080</span>
        </div>
      </div>
      <button className="text-slate-400 hover:text-slate-600"><MoreVertical size={18} /></button>
    </div>
    
    <div className="grid grid-cols-2 gap-4 my-4">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Status</p>
        <p className={`text-sm font-semibold ${status === 'Online' ? 'text-emerald-500' : 'text-red-500'}`}>● {status}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Uptime</p>
        <p className="text-sm font-semibold text-slate-700">{uptime}</p>
      </div>
    </div>

    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
      <div className="flex items-center gap-2">
        <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div className="bg-emerald-500 h-full w-[85%]"></div>
        </div>
        <span className="text-[11px] font-bold text-slate-500">85% CPU</span>
      </div>
      <button className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-all">
        <Power size={12} /> Restart
      </button>
    </div>
  </div>
);

export default function AdminSuite() {
  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900">
      {/* Sidebar Fijo */}
      <aside className="w-64 bg-[#0F172A] p-6 flex flex-col">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="bg-blue-500 p-1.5 rounded-lg text-white"><ShieldCheck size={24} /></div>
          <span className="text-white font-bold text-xl tracking-tight">Admin<span className="text-blue-400">Suite</span></span>
        </div>

        <nav className="space-y-1">
          <NavItem icon={<LayoutDashboard size={20}/>} label="Overview" active />
          <NavItem icon={<Server size={20}/>} label="App Control" />
          <NavItem icon={<Activity size={20}/>} label="System Logs" />
          <NavItem icon={<Settings size={20}/>} label="Settings" />
        </nav>
      </aside>

      {/* Area de Contenido */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 sticky top-0 z-20">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">System Dashboard</h1>
            <p className="text-sm text-slate-500">Welcome back, Administrator</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right mr-2">
              <p className="text-sm font-bold text-slate-800">Super User</p>
              <p className="text-xs text-emerald-500 font-medium tracking-wide">● SERVER ONLINE</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm">AD</div>
          </div>
        </header>

        <div className="p-10 space-y-8 max-w-[1400px] mx-auto">
          {/* Fila de Apps (Controladores) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AppStatusCard name="Inventory App" status="Online" uptime="12d 4h 20m" />
            <AppStatusCard name="Sales API" status="Online" uptime="5d 22h 10m" />
            
            {/* Card de Añadir App (Diseño de la imagen) */}
            <div className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-5 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group text-slate-400">
              <div className="p-3 rounded-full bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 mb-2">
                <Server size={24} />
              </div>
              <span className="font-bold text-sm">Add New Service</span>
            </div>
          </div>

          {/* Sección de Gráfica (Igual a la imagen) */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-lg font-bold">Traffic Monitoring</h3>
                <p className="text-sm text-slate-400 font-medium">Real-time requests across all microservices</p>
              </div>
              <select className="bg-slate-50 border border-slate-200 text-sm rounded-xl px-4 py-2 font-medium outline-none focus:ring-2 ring-blue-500/20">
                <option>Last 24 Hours</option>
                <option>Last 7 Days</option>
              </select>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorApp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Area type="monotone" dataKey="app1" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorApp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false }) {
  return (
    <a href="#" className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all font-medium ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}>
      {icon}
      <span>{label}</span>
    </a>
  );
}