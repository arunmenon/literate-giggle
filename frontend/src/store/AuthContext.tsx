import React, { createContext, useContext, useState, useCallback } from "react";
import type { TokenResponse } from "../types";
import { workspaceAPI } from "../services/api";

interface AuthState {
  token: string | null;
  userId: number | null;
  role: string | null;
  fullName: string | null;
  workspaceId: number | null;
  workspaceRole: string | null;
  workspaceName: string | null;
  workspaceType: string | null;
  isAuthenticated: boolean;
  needsWorkspaceSetup: boolean;
  login: (data: TokenResponse) => void;
  logout: () => void;
  switchWorkspace: (workspaceId: number) => Promise<void>;
  updateWorkspaceState: (
    data: Partial<
      Pick<
        AuthState,
        "workspaceId" | "workspaceRole" | "workspaceName" | "workspaceType"
      >
    >,
  ) => void;
}

const AuthContext = createContext<AuthState>({
  token: null,
  userId: null,
  role: null,
  fullName: null,
  workspaceId: null,
  workspaceRole: null,
  workspaceName: null,
  workspaceType: null,
  isAuthenticated: false,
  needsWorkspaceSetup: false,
  login: () => {},
  logout: () => {},
  switchWorkspace: async () => {},
  updateWorkspaceState: () => {},
});

export const useAuth = () => useContext(AuthContext);

function readFromStorage(key: string): string | null {
  return localStorage.getItem(key);
}

function readNumberFromStorage(key: string): number | null {
  const value = localStorage.getItem(key);
  if (!value || value === "null") return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(readFromStorage("token"));
  const [userId, setUserId] = useState<number | null>(
    readNumberFromStorage("userId"),
  );
  const [role, setRole] = useState<string | null>(readFromStorage("role"));
  const [fullName, setFullName] = useState<string | null>(
    readFromStorage("fullName"),
  );
  const [workspaceId, setWorkspaceId] = useState<number | null>(
    readNumberFromStorage("workspaceId"),
  );
  const [workspaceRole, setWorkspaceRole] = useState<string | null>(
    readFromStorage("workspaceRole"),
  );
  const [workspaceName, setWorkspaceName] = useState<string | null>(
    readFromStorage("workspaceName"),
  );
  const [workspaceType, setWorkspaceType] = useState<string | null>(
    readFromStorage("workspaceType"),
  );

  const login = useCallback((data: TokenResponse) => {
    setToken(data.access_token);
    setUserId(data.user_id);
    setRole(data.role);
    setFullName(data.full_name);
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("userId", String(data.user_id));
    localStorage.setItem("role", data.role);
    localStorage.setItem("fullName", data.full_name);

    // Workspace fields from TokenResponse body (NOT from JWT decode)
    const wsId = data.workspace_id ?? null;
    const wsRole = data.workspace_role ?? null;
    const wsName = data.workspace_name ?? null;
    const wsType = data.workspace_type ?? null;

    setWorkspaceId(wsId);
    setWorkspaceRole(wsRole);
    setWorkspaceName(wsName);
    setWorkspaceType(wsType);

    localStorage.setItem("workspaceId", String(wsId));
    localStorage.setItem("workspaceRole", String(wsRole));
    localStorage.setItem("workspaceName", String(wsName));
    localStorage.setItem("workspaceType", String(wsType));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUserId(null);
    setRole(null);
    setFullName(null);
    setWorkspaceId(null);
    setWorkspaceRole(null);
    setWorkspaceName(null);
    setWorkspaceType(null);

    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("role");
    localStorage.removeItem("fullName");
    localStorage.removeItem("workspaceId");
    localStorage.removeItem("workspaceRole");
    localStorage.removeItem("workspaceName");
    localStorage.removeItem("workspaceType");
  }, []);

  const switchWorkspace = useCallback(async (targetWorkspaceId: number) => {
    const response = await workspaceAPI.switchWorkspace({
      workspace_id: targetWorkspaceId,
    });
    const data: TokenResponse = response.data;

    // Update token and all workspace state from the new TokenResponse
    setToken(data.access_token);
    localStorage.setItem("token", data.access_token);

    const wsId = data.workspace_id ?? null;
    const wsRole = data.workspace_role ?? null;
    const wsName = data.workspace_name ?? null;
    const wsType = data.workspace_type ?? null;

    setWorkspaceId(wsId);
    setWorkspaceRole(wsRole);
    setWorkspaceName(wsName);
    setWorkspaceType(wsType);

    localStorage.setItem("workspaceId", String(wsId));
    localStorage.setItem("workspaceRole", String(wsRole));
    localStorage.setItem("workspaceName", String(wsName));
    localStorage.setItem("workspaceType", String(wsType));
  }, []);

  const updateWorkspaceState = useCallback(
    (
      data: Partial<
        Pick<
          AuthState,
          "workspaceId" | "workspaceRole" | "workspaceName" | "workspaceType"
        >
      >,
    ) => {
      if (data.workspaceId !== undefined) {
        setWorkspaceId(data.workspaceId);
        localStorage.setItem("workspaceId", String(data.workspaceId));
      }
      if (data.workspaceRole !== undefined) {
        setWorkspaceRole(data.workspaceRole);
        localStorage.setItem("workspaceRole", String(data.workspaceRole));
      }
      if (data.workspaceName !== undefined) {
        setWorkspaceName(data.workspaceName);
        localStorage.setItem("workspaceName", String(data.workspaceName));
      }
      if (data.workspaceType !== undefined) {
        setWorkspaceType(data.workspaceType);
        localStorage.setItem("workspaceType", String(data.workspaceType));
      }
    },
    [],
  );

  const needsWorkspaceSetup = !!token && workspaceId === null;

  return (
    <AuthContext.Provider
      value={{
        token,
        userId,
        role,
        fullName,
        workspaceId,
        workspaceRole,
        workspaceName,
        workspaceType,
        isAuthenticated: !!token,
        needsWorkspaceSetup,
        login,
        logout,
        switchWorkspace,
        updateWorkspaceState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
