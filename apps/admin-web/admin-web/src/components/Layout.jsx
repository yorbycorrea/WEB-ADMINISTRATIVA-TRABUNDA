import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Server, Activity, Settings,
  ShieldCheck, LogOut, ChevronRight, Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Ícono SVG simple para la app de Trabunda (trabajadores)
function TrabundaIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

// Ícono SVG simple para la app de Rutas (bus/transporte)
function RutasIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2"/>
      <path d="M16 8h4l3 3v5h-7V8z"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  );
}

// Todos los ítems posibles del sidebar.
// Cada uno tiene un "permission" que se verifica antes de mostrarlo.
// null en permission = visible para todos los que estén logueados.
const ALL_NAV_ITEMS = [
  { to: '/',         icon: <LayoutDashboard size={20}/>, label: 'Overview',     permission: 'overview'  },
  { to: '/trabunda', icon: <TrabundaIcon size={20}/>,    label: 'Trabunda',     permission: 'trabunda'  },
  { to: '/rutas',    icon: <RutasIcon size={20}/>,       label: 'Rutas',        permission: 'rutas'     },
  { to: '/usuarios', icon: <Users size={20}/>,           label: 'Usuarios',     permission: 'users'     },
  { to: '/logs',     icon: <Activity size={20}/>,        label: 'System Logs',  permission: null        },
  { to: '/settings', icon: <Settings size={20}/>,        label: 'Settings',     permission: null        },
];

export default function Layout({ children, title, subtitle }) {
  const { user, logout, hasPermission } = useAuth();

  // Filtramos solo los ítems que el usuario puede ver
  const navItems = ALL_NAV_ITEMS.filter(item =>
    item.permission === null || hasPermission(item.permission)
  );
  const location         = useLocation();
  const navigate         = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900">

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="w-64 bg-[#0F172A] p-6 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="bg-blue-500 p-1.5 rounded-lg text-white">
            <ShieldCheck size={24} />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">
            Admin<span className="text-blue-400">Suite</span>
          </span>
        </div>

        {/* Navegación */}
        <nav className="space-y-1 flex-1">
          {navItems.map(({ to, icon, label }) => {
            // Activo si la ruta es exacta (para /) o si empieza con el path
            const active = to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to);

            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all font-medium
                  ${active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
              >
                {icon}
                <span>{label}</span>
                {active && <ChevronRight size={14} className="ml-auto opacity-70" />}
              </Link>
            );
          })}
        </nav>

        {/* Perfil + logout */}
        <div className="border-t border-slate-800 pt-4 mt-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold uppercase">
              {user?.username?.slice(0, 2) ?? 'AD'}
            </div>
            <div>
              <p className="text-white text-sm font-semibold capitalize">{user?.username ?? 'Admin'}</p>
              <p className="text-slate-500 text-xs">{user?.role ?? 'superadmin'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-all font-medium w-full text-sm"
          >
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* ── Contenido ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-sm uppercase">
            {user?.username?.slice(0, 2) ?? 'AD'}
          </div>
        </header>

        {/* Área de scroll */}
        <main className="flex-1 overflow-y-auto p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
