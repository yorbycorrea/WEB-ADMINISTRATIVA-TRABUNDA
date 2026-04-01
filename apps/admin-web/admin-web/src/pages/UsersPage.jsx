import { useState, useEffect } from 'react';
import { UserPlus, Pencil, Trash2, X, Check, Shield, Eye, EyeOff } from 'lucide-react';
import Layout from '../components/Layout';
import { apiGetUsers, apiCreateUser, apiUpdateUser, apiDeleteUser } from '../api/gateway';

// Las 3 apps/permisos que se pueden asignar
const APP_PERMISSIONS = [
  { key: 'overview',  label: 'Overview',  desc: 'Dashboard general del sistema',   color: 'blue'    },
  { key: 'trabunda',  label: 'Trabunda',  desc: 'Gestión operativa de trabajadores', color: 'violet'  },
  { key: 'rutas',     label: 'Rutas',     desc: 'Control de acceso y transporte',   color: 'emerald' },
];

const colorMap = {
  blue:    'bg-blue-100 text-blue-700 border-blue-200',
  violet:  'bg-violet-100 text-violet-700 border-violet-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

// ─── Modal para crear o editar un usuario ────────────────────────────────────
function UserModal({ user, onClose, onSave }) {
  const isEdit = !!user;
  const [form, setForm]           = useState({
    username:    user?.username    ?? '',
    displayName: user?.displayName ?? '',
    password:    '',
    permissions: user?.permissions ?? [],
  });
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  // Alterna un permiso: si ya está lo quita, si no está lo agrega
  function togglePermission(key) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter(p => p !== key)
        : [...f.permissions, key],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isEdit && !form.password) return setError('La contraseña es requerida');
    if (form.permissions.length === 0) return setError('Asigna al menos un permiso');

    setLoading(true);
    setError('');
    try {
      // Si estamos editando y no se ingresó contraseña, no la enviamos
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    // Fondo oscuro que cubre toda la pantalla (overlay)
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header del modal */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-lg">
            {isEdit ? `Editar: ${user.username}` : 'Nuevo usuario'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Username — solo al crear */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Nombre de usuario
              </label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required
                placeholder="ej: jperez"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          )}

          {/* Nombre para mostrar */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Nombre completo
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              placeholder="ej: Juan Pérez"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Contraseña {isEdit && <span className="font-normal text-slate-400">(dejar vacío para no cambiar)</span>}
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <button type="button" onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>

          {/* Permisos — el corazón de esta página */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Acceso a aplicaciones
            </label>
            <div className="space-y-2">
              {APP_PERMISSIONS.map(app => {
                const active = form.permissions.includes(app.key);
                return (
                  <button
                    key={app.key}
                    type="button"
                    onClick={() => togglePermission(app.key)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                      ${active ? colorMap[app.color] + ' border-current' : 'border-slate-100 hover:border-slate-200'}`}
                  >
                    {/* Checkbox visual */}
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all
                      ${active ? 'bg-current border-current text-white' : 'border-slate-300'}`}>
                      {active && <Check size={12} className="text-white" strokeWidth={3}/>}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{app.label}</p>
                      <p className="text-xs opacity-70">{app.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-all">
              {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function UsersPage() {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // null | 'create' | { user }
  const [deleting, setDeleting] = useState(null); // id del usuario que se está borrando

  async function fetchUsers() {
    setLoading(true);
    try {
      const data = await apiGetUsers();
      setUsers(data.users ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleSave(payload) {
    if (modal === 'create') {
      const data = await apiCreateUser(payload);
      if (data.error) throw new Error(data.error);
    } else {
      const data = await apiUpdateUser(modal.user.id, payload);
      if (data.error) throw new Error(data.error);
    }
    fetchUsers();
  }

  async function handleDelete(user) {
    if (!window.confirm(`¿Eliminar al usuario "${user.username}"?`)) return;
    setDeleting(user.id);
    await apiDeleteUser(user.id);
    setDeleting(null);
    fetchUsers();
  }

  return (
    <Layout title="Gestión de usuarios" subtitle="Solo el superadmin puede crear y editar usuarios">

      {/* Modal */}
      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal.user}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      <div className="max-w-[900px] space-y-6">

        {/* Header con botón de crear */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">
              {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setModal('create')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all"
          >
            <UserPlus size={16} />
            Nuevo usuario
          </button>
        </div>

        {/* Tabla de usuarios */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <Shield size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="font-semibold text-slate-500">No hay usuarios todavía</p>
              <p className="text-sm text-slate-400 mt-1">Crea el primer usuario con el botón de arriba</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Usuario</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Acceso a apps</th>
                  <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Creado</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    {/* Info del usuario */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                          {user.username.slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{user.displayName || user.username}</p>
                          <p className="text-xs text-slate-400">@{user.username}</p>
                        </div>
                      </div>
                    </td>

                    {/* Permisos como badges */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {user.permissions?.length === 0 && (
                          <span className="text-xs text-red-400 font-medium">Sin acceso</span>
                        )}
                        {user.permissions?.map(p => {
                          const app = APP_PERMISSIONS.find(a => a.key === p);
                          return app ? (
                            <span key={p} className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${colorMap[app.color]}`}>
                              {app.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </td>

                    {/* Fecha de creación */}
                    <td className="px-6 py-4 text-slate-400 text-xs">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES') : '—'}
                    </td>

                    {/* Acciones */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setModal({ user })}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={deleting === user.id}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                          title="Eliminar"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Nota informativa */}
        <div className="bg-slate-900 rounded-2xl p-5 text-sm">
          <p className="text-white font-semibold mb-2">¿Cómo funcionan los permisos?</p>
          <ul className="text-slate-400 space-y-1 text-xs">
            <li>• <span className="text-blue-400">Overview</span> — ve el dashboard general con estado de todos los servicios</li>
            <li>• <span className="text-violet-400">Trabunda</span> — ve reportes, áreas y módulos operativos de Trabunda</li>
            <li>• <span className="text-emerald-400">Rutas</span> — ve empresas de transporte, jornadas y sesiones de escaneo</li>
            <li className="pt-1 text-slate-500">El superadmin siempre tiene acceso total y no aparece en esta lista.</li>
          </ul>
        </div>

      </div>
    </Layout>
  );
}
