import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// permission (opcional): si se pasa, verifica que el usuario tenga ese permiso.
// Si no tiene token → va al login.
// Si tiene token pero no el permiso → va a su página de inicio.
export default function ProtectedRoute({ children, permission }) {
  const { token, hasPermission, getHomePage } = useAuth();

  if (!token) return <Navigate to="/login" replace />;

  if (permission && !hasPermission(permission)) {
    return <Navigate to={getHomePage()} replace />;
  }

  return children;
}
