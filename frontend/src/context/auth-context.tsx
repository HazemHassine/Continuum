"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiClient } from "@/lib/api-client";
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
  sessionError: string | null;
  retrySession: () => void;
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
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const authVersion = useRef(0);

  useEffect(() => {
    let active = true;
    const version = ++authVersion.current;
    const isCurrent = () => active && version === authVersion.current;
    async function initAuth() {
      setIsLoading(true);
      setSessionError(null);
      const storedToken = getAuthToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      setTokenState(storedToken);
      try {
        const profile = await apiClient<AuthUser>("/api/v1/auth/me");
        if (!isCurrent()) return;
        setUser(profile);
      } catch (err) {
        if (!isCurrent()) return;
        if (err instanceof ApiError && err.status === 401) {
          removeAuthToken();
          setTokenState(null);
          setUser(null);
        } else {
          setSessionError(
            "We couldn’t reach your notebook. Your saved session hasn’t been removed.",
          );
        }
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    }

    initAuth();
    return () => {
      active = false;
    };
  }, [sessionAttempt]);

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    const version = ++authVersion.current;
    setSessionError(null);
    setIsLoading(true);
    try {
      const data = await apiClient<AuthResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (version !== authVersion.current) {
        throw new Error("This sign-in attempt is no longer active.");
      }
      setAuthToken(data.access_token);
      setTokenState(data.access_token);
      setUser(data.user);
      return data;
    } finally {
      if (version === authVersion.current) setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string
  ): Promise<AuthResponse> => {
    const version = ++authVersion.current;
    setSessionError(null);
    setIsLoading(true);
    try {
      const data = await apiClient<AuthResponse>("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (version !== authVersion.current) {
        throw new Error("This registration attempt is no longer active.");
      }
      setAuthToken(data.access_token);
      setTokenState(data.access_token);
      setUser(data.user);
      return data;
    } finally {
      if (version === authVersion.current) setIsLoading(false);
    }
  };

  const signOut = async () => {
    ++authVersion.current;
    removeAuthToken();
    setTokenState(null);
    setUser(null);
    setSessionError(null);
    setIsLoading(false);
  };

  const refreshProfile = async (): Promise<AuthUser | null> => {
    const version = authVersion.current;
    try {
      const profile = await apiClient<AuthUser>("/api/v1/auth/me");
      if (version !== authVersion.current) return null;
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
        sessionError,
        retrySession: () => setSessionAttempt((attempt) => attempt + 1),
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
