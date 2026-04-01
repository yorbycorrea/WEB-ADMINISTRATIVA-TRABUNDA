import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login      from './pages/Login';
import Dashboard  from './pages/Dashboard';
import TrabundaPage from './pages/TrabundaPage';
import RutasPage    from './pages/RutasPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/trabunda" element={<ProtectedRoute><TrabundaPage /></ProtectedRoute>} />
          <Route path="/rutas"    element={<ProtectedRoute><RutasPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
