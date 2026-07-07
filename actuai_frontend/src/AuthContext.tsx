import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  token: string | null;
  username: string | null;
  role: string | null;
  login: (token: string) => void;
  logout: () => void;
}

function decodeJwt(token: string): { sub?: string; role?: string } {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('actuai_token'));
  const decoded = token ? decodeJwt(token) : {};
  const username = decoded.sub ?? null;
  const role = decoded.role ?? null;

  useEffect(() => {
    const handleAuthChange = () => {
      setToken(localStorage.getItem('actuai_token'));
    };
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem('actuai_token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('actuai_token');
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, username, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
