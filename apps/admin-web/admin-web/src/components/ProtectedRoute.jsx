import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Este componente actúa como un "guardia" en la ruta.
// Si el usuario tiene token → renderiza los children (la página real).
// Si no tiene token → lo manda al login con <Navigate>.
export default function ProtectedRoute({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}
