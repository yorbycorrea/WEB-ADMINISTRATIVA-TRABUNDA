import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login       from './pages/Login';
import Dashboard   from './pages/Dashboard';
import TrabundaPage from './pages/TrabundaPage';
import RutasPage    from './pages/RutasPage';
import UsersPage    from './pages/UsersPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Pública */}
          <Route path="/login" element={<Login />} />

          {/* Cada ruta tiene su permiso requerido.
              ProtectedRoute redirige automáticamente si no tiene acceso. */}
          <Route path="/" element={
            <ProtectedRoute permission="overview">
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/trabunda" element={
            <ProtectedRoute permission="trabunda">
              <TrabundaPage />
            </ProtectedRoute>
          } />

          <Route path="/rutas" element={
            <ProtectedRoute permission="rutas">
              <RutasPage />
            </ProtectedRoute>
          } />

          {/* Solo superadmin puede ver esta página (permiso "users") */}
          <Route path="/usuarios" element={
            <ProtectedRoute permission="users">
              <UsersPage />
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
