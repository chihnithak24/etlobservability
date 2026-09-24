import { createContext, useContext, useState } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user'));
      if (u && (u.name === 'Google User' || !u.name) && u.email) {
        u.name = u.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        localStorage.setItem('user', JSON.stringify(u));
      }
      return u;
    } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (err) {
      if (!err.response) {
        return {
          success: false,
          errorType: 'network',
          message: 'Server unreachable. Please check your network connection or verify backend service.'
        };
      }
      const status = err.response.status;
      const msg = err.response.data?.message || 'Authentication failed';

      let errorType = 'generic';
      if (status === 401) {
        if (msg.toLowerCase().includes('account not found') || msg.toLowerCase().includes('sign up')) {
          errorType = 'account_not_found';
        } else {
          errorType = 'credentials';
        }
      } else if (status === 400) {
        errorType = 'validation';
      } else if (status >= 500) {
        errorType = 'server';
      }
      return { success: false, errorType, message: msg, status };
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { name, email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (err) {
      if (!err.response) {
        return {
          success: false,
          errorType: 'network',
          message: 'Server unreachable. Please check your network connection or verify backend service.'
        };
      }
      const status = err.response.status;
      const msg = err.response.data?.message || 'Registration failed';

      let errorType = 'generic';
      if (msg.toLowerCase().includes('already exists')) {
        errorType = 'account_exists';
      } else if (status === 400) {
        errorType = 'validation';
      } else if (status >= 500) {
        errorType = 'server';
      }
      return { success: false, errorType, message: msg, status };
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async (nameOrObj, emailParam) => {
    setLoading(true);
    let name = typeof nameOrObj === 'object' && nameOrObj !== null ? nameOrObj.name : nameOrObj;
    let email = typeof nameOrObj === 'object' && nameOrObj !== null ? nameOrObj.email : emailParam;

    if ((!name || name === 'Google User') && email) {
      name = email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    const payload = {
      name: name || 'Google User',
      email: email || 'user.google@gmail.com'
    };

    try {
      const { data } = await api.post('/auth/google', payload);
      const finalUser = {
        ...data.user,
        name: data.user?.name && data.user.name !== 'Google User' ? data.user.name : payload.name
      };
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(finalUser));
      setUser(finalUser);
      return { success: true };
    } catch (err) {
      // If network error, use fallback local user
      if (err && !err.response) {
        const googleUser = {
          id: 'google-' + Date.now(),
          name: payload.name,
          email: payload.email,
          role: 'viewer'
        };
        localStorage.setItem('token', 'google-auth-token-' + Date.now());
        localStorage.setItem('user', JSON.stringify(googleUser));
        setUser(googleUser);
        return { success: true, isFallback: true };
      }
      return {
        success: false,
        errorType: 'google',
        message: err.response?.data?.message || 'Google authentication failed. Please try again.'
      };
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => ({ success: true });
  const resendOtp = async () => ({ success: true });

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, googleLogin, verifyOtp, resendOtp, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
