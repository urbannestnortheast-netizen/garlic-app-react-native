import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, loadToken, setToken as saveToken } from "@/src/api/client";

export type User = { id: string; name: string; email: string; mobile: string; role: string };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  signup: (name: string, email: string, mobile: string, password: string) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api<User>("/auth/me", { auth: true });
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      if (t) await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const signup = async (name: string, email: string, mobile: string, password: string) => {
    const r = await api<{ access_token: string; user: User }>("/auth/signup", {
      method: "POST",
      body: { name, email, mobile, password },
    });
    await saveToken(r.access_token);
    setUser(r.user);
  };

  const login = async (identifier: string, password: string) => {
    const r = await api<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { identifier, password },
    });
    await saveToken(r.access_token);
    setUser(r.user);
  };

  const logout = async () => {
    await saveToken(null);
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, signup, login, logout, refresh }}>{children}</Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
