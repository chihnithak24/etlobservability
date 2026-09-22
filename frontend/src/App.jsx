import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Jobs from './pages/Jobs';
import JobDetails from './pages/JobDetails';
import Monitoring from './pages/Monitoring';
import Analytics from './pages/Analytics';
import Alerts from './pages/Alerts';
import Prediction from './pages/Prediction';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import Dags from './pages/Dags';
import RcaPage from './pages/RcaPage';
import RecoveryPage from './pages/RecoveryPage';
import ErrorBoundary from './components/ui/ErrorBoundary';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/dags" element={<PrivateRoute><Dags /></PrivateRoute>} />
      <Route path="/jobs" element={<PrivateRoute><Jobs /></PrivateRoute>} />
      <Route path="/jobs/:id" element={<PrivateRoute><JobDetails /></PrivateRoute>} />
      <Route path="/monitoring" element={<PrivateRoute><Monitoring /></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
      <Route path="/alerts" element={<PrivateRoute><Alerts /></PrivateRoute>} />
      <Route path="/prediction" element={<PrivateRoute><Prediction /></PrivateRoute>} />
      <Route path="/rca" element={<PrivateRoute><RcaPage /></PrivateRoute>} />
      <Route path="/recovery" element={<PrivateRoute><RecoveryPage /></PrivateRoute>} />
      <Route path="/logs" element={<PrivateRoute><Logs /></PrivateRoute>} />
      <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
            <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border-color)' } }} />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
