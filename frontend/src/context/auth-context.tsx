"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiClient } from "@/lib/api-client";
import {
  type AuthUser,
  type AuthResponse,
  getAuthToken,
  setAuthToken,
  removeAuthToken,
} from "@/lib/auth";

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      setTokenState(storedToken);
      try {
        const profile = await apiClient<AuthUser>("/api/v1/auth/me");
        setUser(profile);
      } catch (err) {
        console.warn("Session token expired or invalid:", err);
        removeAuthToken();
        setTokenState(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const data = await apiClient<AuthResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(data.access_token);
      setTokenState(data.access_token);
      setUser(data.user);
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string
  ): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const data = await apiClient<AuthResponse>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setAuthToken(data.access_token);
      setTokenState(data.access_token);
      setUser(data.user);
      return data;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    removeAuthToken();
    setTokenState(null);
    setUser(null);
  };

  const refreshProfile = async (): Promise<AuthUser | null> => {
    try {
      const profile = await apiClient<AuthUser>("/api/v1/auth/me");
      setUser(profile);
      return profile;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
