import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const getApiErrorMessage = (err, fallback) => {
    const payload = err?.response?.data;
    if (typeof payload?.error === 'string') return payload.error;
    if (payload?.error?.message) return payload.error.message;
    if (payload?.message) return payload.message;
    return fallback;
  };

  const checkAuth = async () => {
    const token = sessionStorage.getItem('token');
    localStorage.removeItem('token');
    if (token) {
      try {
        const response = await authAPI.getCurrentUser();
        setUser(response.data.user);
      } catch {
        // Access token expired — the 401 interceptor in api.js will attempt
        // a silent refresh using the stored refreshToken automatically.
        // If that also fails, it redirects to /login (handled in api.js).
        sessionStorage.removeItem('token');
        setUser(null);
      }
    }
    setLoading(false);
  };

  // S-005 helpers — store/clear both tokens together
  const storeTokens = (token, refreshToken) => {
    sessionStorage.setItem('token', token);
    if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
    localStorage.removeItem('token');
  };

  const clearTokens = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    localStorage.removeItem('token');
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await authAPI.login({ email, password });
      const { token, refreshToken, user } = response.data;
      storeTokens(token, refreshToken);
      setUser(user);
      return { success: true };
    } catch (err) {
      const message = getApiErrorMessage(err, 'Login failed');
      setError(message);
      return { success: false, error: message };
    }
  };

  const register = async (email, password, fullName, role, program, department) => {
    try {
      setError(null);
      const response = await authAPI.register({ email, password, fullName, role, program, department });
      const { token, refreshToken, user } = response.data;
      storeTokens(token, refreshToken);
      setUser(user);
      return { success: true };
    } catch (err) {
      const message = getApiErrorMessage(err, 'Registration failed');
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      // S-005: revoke refresh token on server before clearing locally
      const refreshToken = sessionStorage.getItem('refreshToken');
      if (refreshToken) {
        await authAPI.logout(refreshToken).catch(() => {/* fire-and-forget */});
      }
    } finally {
      clearTokens();
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};