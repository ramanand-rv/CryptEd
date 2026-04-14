import React, { createContext, useState, useContext, ReactNode } from "react";
import axios from "axios";

interface User {
  id: string;
  walletAddress: string;
  name: string;
  role: string;
  ownedNFTs?: Array<{
    mintAddress: string;
    courseId?: string;
    courseTitle?: string;
    mintedAt?: string;
    verifyUrl?: string;
    explorerUrl?: string;
  }>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loginWithWallet: (walletAddress: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const api = axios.create({ baseURL: "http://localhost:5000/api" });

  const loginWithWallet = async (walletAddress: string, name?: string) => {
    try {
      const res = await api.post("/auth/login/wallet", { walletAddress, name });
      setToken(res.data.token);
      setUser(res.data.user);
      // Optionally store token in AsyncStorage
    } catch (err) {
      console.error(err);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loginWithWallet, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
