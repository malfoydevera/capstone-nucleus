import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, unwrapApiData } from '../utils/api';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from '../utils/authStorage';

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

  const getApiErrorCode = (err) => {
    const payload = err?.response?.data;
    return payload?.error?.code || payload?.code || null;
  };

  const checkAuth = async () => {
    const token = getAccessToken();
    const refreshToken = getRefreshToken();

    if (token || refreshToken) {
      try {
        const response = await authAPI.getCurrentUser();
        setUser(unwrapApiData(response).user || null);
      } catch (err) {
        clearAuthTokens();
        setUser(null);
      }
    }
    setLoading(false);
  };

  const login = async (email, password, rememberMe = false) => {
    try {
      setError(null);
      const response = await authAPI.login({ email, password });
      const { token, refreshToken, user } = unwrapApiData(response);

      setAuthTokens(token, refreshToken, rememberMe);

      setUser(user);
      return { success: true };
    } catch (err) {
      const message = getApiErrorMessage(err, 'Login failed');
      setError(message);
      return { success: false, error: message, code: getApiErrorCode(err) };
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
      const data = unwrapApiData(response);

      // New flow: signup requires email confirmation, so no session is issued.
      if (data?.confirmationRequired) {
        return { success: true, confirmationRequired: true, email: data.email || email };
      }

      // Backward compatibility: if a session is ever returned, log in directly.
      const { token, refreshToken, user } = data;
      if (token) {
        setAuthTokens(token, refreshToken, false);
        setUser(user);
      }
      return { success: true };
    } catch (err) {
      const message = getApiErrorMessage(err, 'Registration failed');
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = () => {
    clearAuthTokens();
    setUser(null);
  };

  const updateProfile = async (data) => {
    try {
      setError(null);
      const response = await authAPI.updateProfile(data);
      const payload = unwrapApiData(response);
      const updatedUser = payload.user || null;
      if (updatedUser) {
        setUser(updatedUser);
      }
      return { success: true, user: updatedUser };
    } catch (err) {
      const message = getApiErrorMessage(err, 'Failed to update profile');
      setError(message);
      return { success: false, error: message };
    }
  };

  const reloadUser = async () => {
    try {
      const response = await authAPI.getCurrentUser();
      const loadedUser = unwrapApiData(response).user || null;
      setUser(loadedUser);
      return loadedUser;
    } catch (err) {
      return null;
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    reloadUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
