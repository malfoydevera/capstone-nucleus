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
    // CHANGE: Use sessionStorage
    const token = sessionStorage.getItem('token');
    localStorage.removeItem('token');
    if (token) {
      try {
        const response = await authAPI.getCurrentUser();
        setUser(response.data.user);
      } catch (err) {
        // CHANGE: Use sessionStorage
        sessionStorage.removeItem('token');
        setUser(null);
      }
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await authAPI.login({ email, password });
      const { token, user } = response.data;
      // CHANGE: Use sessionStorage
      sessionStorage.setItem('token', token);
      localStorage.removeItem('token');
      setUser(user);
      return { success: true };
    } catch (err) {
      const message = getApiErrorMessage(err, 'Login failed');
      setError(message);
      return { success: false, error: message };
    }
  };

  const register = async ({ email, password, firstName, middleName, lastName, role, program, programId, department, departmentId }) => {
    try {
      setError(null);
      const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      const response = await authAPI.register({
        email,
        password,
        firstName,
        middleName,
        lastName,
        fullName,
        role,
        program,
        programId,
        department,
        departmentId,
      });
      const { token, user } = response.data;
      sessionStorage.setItem('token', token);
      localStorage.removeItem('token');
      setUser(user);
      return { success: true };
    } catch (err) {
      const message = getApiErrorMessage(err, 'Registration failed');
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = () => {
    // CHANGE: Use sessionStorage
    sessionStorage.removeItem('token');
    localStorage.removeItem('token');
    setUser(null);
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