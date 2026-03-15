import React, { createContext, useContext, useState, useEffect } from "react";
import type { TokenResponse } from "../types";

interface AuthState {
  token: string | null;
  userId: number | null;
  role: string | null;
  fullName: string | null;
  isAuthenticated: boolean;
  login: (data: TokenResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  token: null,
  userId: null,
  role: null,
  fullName: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [userId, setUserId] = useState<number | null>(
    Number(localStorage.getItem("userId")) || null
  );
  const [role, setRole] = useState<string | null>(
    localStorage.getItem("role")
  );
  const [fullName, setFullName] = useState<string | null>(
    localStorage.getItem("fullName")
  );

  const login = (data: TokenResponse) => {
    setToken(data.access_token);
    setUserId(data.user_id);
    setRole(data.role);
    setFullName(data.full_name);
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("userId", String(data.user_id));
    localStorage.setItem("role", data.role);
    localStorage.setItem("fullName", data.full_name);
  };

  const logout = () => {
    setToken(null);
    setUserId(null);
    setRole(null);
    setFullName(null);
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("role");
    localStorage.removeItem("fullName");
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        userId,
        role,
        fullName,
        isAuthenticated: !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
