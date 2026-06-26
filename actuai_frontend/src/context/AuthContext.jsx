// context/AuthContext.jsx — app-wide authentication state.
//
// Holds the JWT in memory (not localStorage: a token in localStorage is
// readable by any injected script, an XSS token-theft risk; a real production
// deploy would use an httpOnly cookie). Exposes the current user's claims so
// the UI can adapt (e.g. show the role), and a 401 handler that logs out.

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { login as apiLogin } from "../lib/api.js";

const AuthContext = createContext(null);

/** Decode the (unverified) JWT payload just to display role/username. The
 *  server is always the authority; this is for UI personalization only. */
function decodeClaims(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { username: payload.sub, role: payload.role, clearance: payload.clearance };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const signIn = async (username, password) => {
    const { access_token } = await apiLogin(username, password);
    setToken(access_token);
    setUser(decodeClaims(access_token));
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ token, user, isAuthenticated: Boolean(token), signIn, signOut }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
