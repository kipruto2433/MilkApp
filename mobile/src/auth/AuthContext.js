import React, { createContext, useState, useEffect } from 'react';
import api, { setAuthToken } from '../api';
import { saveAuth, loadAuth, clearAuth } from '../utils/storage';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { token: storedToken, user: storedUser } = await loadAuth();
        if (storedToken) {
          setAuthToken(storedToken);
          setToken(storedToken);
          setUser(storedUser);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = async (phone, password, expectedRole) => {
    const res = await api.post('/auth/login', { phone, password });
    const { token: t, user: u } = res.data;
    if (expectedRole && u.role !== expectedRole) {
      throw new Error(`This account is not registered as a ${expectedRole}.`);
    }
    setAuthToken(t);
    setToken(t);
    setUser(u);
    await saveAuth(t, u);
    return { token: t, user: u };
  };

  const signUp = async (payload) => {
    const signupPayload = { ...payload, role: 'collector' };
    const res = await api.post('/auth/signup', signupPayload);
    const { token: t, user: u } = res.data;
    setAuthToken(t);
    setToken(t);
    setUser(u);
    await saveAuth(t, u);
    return { token: t, user: u };
  };

  const signOut = async () => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
    await clearAuth();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
