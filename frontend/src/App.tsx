import { Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav';
import VerseBanner from './components/VerseBanner';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import WheelPage from './pages/WheelPage';
import StatsPage from './pages/StatsPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <Nav />
      <VerseBanner />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/wheel" element={<WheelPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAdmin>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/wheel" replace />} />
        </Routes>
      </main>
    </div>
  );
}
