import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Loader } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiLogin } from '../api/gateway';

export default function Login() {
  const { login } = useAuth();
  const navigate   = useNavigate(); // hook para cambiar de ruta sin recargar

  const [form, setForm]         = useState({ username: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  function handleChange(e) {
    // Actualizamos solo el campo que cambió, manteniendo el resto del form
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(''); // limpiamos el error al escribir
  }

  async function handleSubmit(e) {
    e.preventDefault(); // evitamos que el formulario recargue la página
    setLoading(true);
    setError('');

    try {
      const data = await apiLogin(form.username, form.password);

      if (data.token) {
        // login() guarda el token en contexto y localStorage
        login(data.token, data.user);
        // navigate redirige al dashboard sin recargar el navegador
        navigate('/', { replace: true });
      } else {
        // El backend devolvió error (credenciales incorrectas)
        setError(data.error || 'Credenciales incorrectas');
      }
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="bg-blue-500 p-2 rounded-xl">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <span className="text-white font-bold text-2xl tracking-tight">
            Admin<span className="text-blue-400">Suite</span>
          </span>
        </div>

        {/* Card del formulario */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 shadow-2xl backdrop-blur">
          <h1 className="text-white font-bold text-xl mb-1">Iniciar sesión</h1>
          <p className="text-slate-400 text-sm mb-8">Accede al panel de administración</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo usuario */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Usuario
              </label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="admin"
                required
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600"
              />
            </div>

            {/* Campo contraseña con toggle de visibilidad */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-4 py-3 pr-11 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Mensaje de error */}
            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            {/* Botón de submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold rounded-xl py-3 text-sm transition-all flex items-center justify-center gap-2 mt-2"
            >
              {loading
                ? <><Loader size={16} className="animate-spin" /> Verificando...</>
                : 'Entrar al panel'
              }
            </button>
          </form>
        </div>

        {/* Hint de credenciales para desarrollo */}
        <p className="text-center text-slate-600 text-xs mt-6">
          Dev: admin / admin123
        </p>
      </div>
    </div>
  );
}
