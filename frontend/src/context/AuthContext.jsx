import { createContext, useContext, useState } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password, forceOtp = false) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password, forceOtp });
      if (data.requiresOtp) {
        return { success: true, requiresOtp: true, email: data.email, message: data.message, otpDemo: data.otpDemo };
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true, requiresOtp: false };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (email, otp) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { email, otp });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'OTP verification failed' };
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async (email) => {
    try {
      const { data } = await api.post('/auth/resend-otp', { email });
      return { success: true, message: data.message, otpDemo: data.otpDemo };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Failed to resend OTP' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, verifyOtp, resendOtp, logout, loading }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
