import { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'));
  const [user, setUser]   = useState(() => {
    const saved = localStorage.getItem('admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  function login(newToken, userData) {
    localStorage.setItem('admin_token', newToken);
    localStorage.setItem('admin_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null);
    setUser(null);
  }

  // Verifica si el usuario tiene un permiso específico.
  // El superadmin siempre tiene acceso a todo.
  function hasPermission(permission) {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    return user.permissions?.includes(permission) ?? false;
  }

  // Devuelve la primera página a la que el usuario tiene acceso.
  // Útil para redirigir después del login.
  function getHomePage() {
    if (user?.role === 'superadmin') return '/';
    if (hasPermission('overview'))  return '/';
    if (hasPermission('trabunda'))  return '/trabunda';
    if (hasPermission('rutas'))     return '/rutas';
    return '/sin-acceso';
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, hasPermission, getHomePage }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
