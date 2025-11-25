import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

axios.defaults.withCredentials = true;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      const res = await axios.get('http://localhost:3001/api/auth/me');
      setUser(res.data); 
    } catch (e) {
      setUser(null); 
    } finally {
      setLoading(false);
    }
  };

  const login = (role, email) => {
    setUser({ role, email });
  };

  const logout = async () => {
    try {
      await axios.post('http://localhost:3001/api/auth/logout');
      setUser(null);
    } catch (e) {
      console.error("Logout failed", e);
    }
  };

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          if (window.location.pathname !== '/') {
             setUser(null); 
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);