import { createContext, useContext, useState } from 'react';

// 1. Creamos el contexto — es como una "sala de reuniones" donde
//    cualquier componente hijo puede leer o modificar el estado de auth.
const AuthContext = createContext(null);

// 2. El Provider envuelve toda la app y expone los valores del contexto
export function AuthProvider({ children }) {
  // Intentamos recuperar el token del localStorage al iniciar
  // para que el usuario siga logueado si ya había iniciado sesión antes
  const [token, setToken] = useState(() => localStorage.getItem('admin_token'));
  const [user, setUser]   = useState(() => {
    const saved = localStorage.getItem('admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  // login: guarda el token y el usuario en estado y en localStorage
  function login(newToken, userData) {
    localStorage.setItem('admin_token', newToken);
    localStorage.setItem('admin_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  }

  // logout: borra todo
  function logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// 3. Hook personalizado para consumir el contexto fácilmente
//    En lugar de escribir useContext(AuthContext) en cada archivo,
//    simplemente escribimos useAuth()
export function useAuth() {
  return useContext(AuthContext);
}
