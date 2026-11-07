import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./api";
import type { User } from "./types";

interface AuthValue {
  user: User | null;
  ready: boolean;           // false until the first /api/auth/me check has finished
  signIn: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    api.me().then((s) => { if (alive) setUser(s.user); }).catch(() => undefined).finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => { const u = await api.login({ email, password }); setUser(u); return u; }, []);
  const register = useCallback(async (name: string, email: string, password: string) => { const u = await api.register({ name, email, password }); setUser(u); return u; }, []);
  const signOut = useCallback(async () => { try { await api.logout(); } finally { setUser(null); } }, []);

  const value = useMemo(() => ({ user, ready, signIn, register, signOut }), [user, ready, signIn, register, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
