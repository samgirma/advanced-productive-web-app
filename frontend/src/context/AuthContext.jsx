import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if session cookie is already active on page load
  useEffect(() => {
    async function checkAuth() {
      try {
        const userData = await api.getMe();
        setUser(userData);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    return data.user;
  };

  const register = async (email, password) => {
    const data = await api.register(email, password);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  };

  const updateUserTimezone = (newTz) => {
    setUser(prev => prev ? { ...prev, timezone: newTz } : null);
  };

  const userTimezone = user?.timezone || 'UTC';

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, userTimezone, updateUserTimezone }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
