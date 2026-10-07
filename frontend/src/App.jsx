import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import ErrorBoundary from './components/ui/ErrorBoundary';

const PrivateRoute = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  return user ? children : <Navigate to="/login" state={{ from: location }} replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/jobs" element={<PrivateRoute><Jobs /></PrivateRoute>} />
      <Route path="/jobs/:id" element={<PrivateRoute><JobDetails /></PrivateRoute>} />
      <Route path="/monitoring" element={<PrivateRoute><Monitoring /></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
      <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
      <Route path="/alerts" element={<PrivateRoute><Alerts /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />

      {/* Redirect legacy / duplicate URLs to primary core features */}
      <Route path="/dags" element={<Navigate to="/jobs" replace />} />
      <Route path="/pipelines" element={<Navigate to="/jobs" replace />} />
      <Route path="/live-monitor" element={<Navigate to="/monitoring" replace />} />
      <Route path="/live" element={<Navigate to="/monitoring" replace />} />
      <Route path="/monitor" element={<Navigate to="/monitoring" replace />} />
      <Route path="/prediction" element={<Navigate to="/analytics" replace />} />
      <Route path="/rca" element={<Navigate to="/alerts" replace />} />
      <Route path="/recovery" element={<Navigate to="/jobs" replace />} />
      <Route path="/logs" element={<Navigate to="/jobs" replace />} />
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
            <Toaster
              position="top-right"
              containerStyle={{ top: 20, right: 20 }}
              toastOptions={{
                duration: 4500,
                style: { background: 'transparent', boxShadow: 'none', border: 'none', padding: 0 }
              }}
            />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
