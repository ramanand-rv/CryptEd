/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useEffect, useState, useContext } from "react";
import type { ReactNode } from "react";

import { api } from "../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  walletAddress?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  );
  const [loading, setLoading] = useState<boolean>(!!token);

  useEffect(() => {
    let isMounted = true;
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/users/me", { headers: { "x-auth-token": token } })
      .then((res) => {
        if (!isMounted) return;
        setUser(res.data);
      })
      .catch(() => {
        if (!isMounted) return;
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const res = await api.post("/auth/login/educator", { email, password });
      localStorage.setItem("token", res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.msg || "Login failed",
      };
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const res = await api.post("/auth/register/educator", {
        email,
        password,
        name,
      });
      localStorage.setItem("token", res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.msg || "Registration failed",
      };
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    const res = await api.get("/users/me", {
      headers: { "x-auth-token": token },
    });
    setUser(res.data);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
