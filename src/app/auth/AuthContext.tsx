import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  ApiError,
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  refreshSession,
  register as apiRegister,
  type AuthUser,
  type LoginPayload,
  type RegisterPayload,
} from "../api/authApi";

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isBootstrapping: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const refreshed = await refreshSession();
      setAccessToken(refreshed.accessToken);

      const me = await getCurrentUser(refreshed.accessToken);
      setUser(me.user);
      return me.user;
    } catch {
      setAccessToken(null);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsBootstrapping(false));
  }, [refreshUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await apiLogin(payload);
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const result = await apiRegister(payload);
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, accessToken, isBootstrapping, login, register, logout, refreshUser }),
    [user, accessToken, isBootstrapping, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
