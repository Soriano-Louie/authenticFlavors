import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { toast } from "sonner";
import {
  ApiError,
  getCurrentUser,
  login as apiLogin,
  logout as apiLogout,
  refreshSession,
  register as apiRegister,
  updateProfile as apiUpdateProfile,
  uploadProfilePhoto as apiUploadProfilePhoto,
  requestEmailChange as apiRequestEmailChange,
  verifyEmailChange as apiVerifyEmailChange,
  changePassword as apiChangePassword,
  type AuthUser,
  type LoginPayload,
  type RegisterPayload,
  type UpdateProfilePayload,
} from "../api/authApi";

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isBootstrapping: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  register: (payload: RegisterPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  updateProfile: (payload: UpdateProfilePayload) => Promise<AuthUser>;
  changeProfilePhoto: (file: File) => Promise<AuthUser>;
  requestEmailChange: (newEmail: string) => Promise<{ message: string }>;
  verifyEmailChange: (newEmail: string, code: string) => Promise<AuthUser>;
  changePassword: (payload: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) => Promise<{ message: string }>;
  setAuth: (accessToken: string, user: AuthUser) => void;
}

const CACHED_USER_KEY = "af_cached_user";
const HAS_SESSION_KEY = "af_has_session";

function getCachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function hasLocalSession(): boolean {
  try {
    return localStorage.getItem(HAS_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

function saveCachedUser(u: AuthUser | null) {
  try {
    if (u) {
      localStorage.setItem(CACHED_USER_KEY, JSON.stringify(u));
      localStorage.setItem(HAS_SESSION_KEY, "true");
    } else {
      localStorage.removeItem(CACHED_USER_KEY);
      localStorage.removeItem(HAS_SESSION_KEY);
    }
  } catch {
    // Ignore storage quota limits
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUserState] = useState<AuthUser | null>(getCachedUser);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  // Only block if a previous active session is recorded; visitors bootstrap immediately (0ms)
  const [isBootstrapping, setIsBootstrapping] = useState(() => hasLocalSession());

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u);
    saveCachedUser(u);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      // Single network roundtrip: refreshSession already returns both user & accessToken
      const refreshed = await refreshSession();
      setAccessToken(refreshed.accessToken);
      setUser(refreshed.user);
      return refreshed.user;
    } catch {
      setAccessToken(null);
      setUser(null);
      return null;
    }
  }, [setUser]);

  useEffect(() => {
    // If a session exists, refresh it; if not, do a silent background check without blocking
    refreshUser().finally(() => setIsBootstrapping(false));
  }, [refreshUser]);

  // Single-session: if any API call reports the session was revoked
  // (logged in elsewhere, password/email changed, account suspended),
  // clear the local session so the guards redirect to the sign-in page.
  useEffect(() => {
    const handleSessionExpired = () => {
      setAccessToken(null);
      setUser(null);
    };
    window.addEventListener(
      "authenticflavors:unauthorized",
      handleSessionExpired,
    );
    return () =>
      window.removeEventListener(
        "authenticflavors:unauthorized",
        handleSessionExpired,
      );
  }, [setUser]);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await apiLogin(payload);
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result.user;
  }, [setUser]);

  const register = useCallback(async (payload: RegisterPayload) => {
    await apiRegister(payload);
    // Registration now returns { message, email } — user must verify email first
    // Do NOT set tokens or user — they are not returned
    // Return a dummy user to satisfy the interface; the caller redirects to verify-email
    return { user_id: 0, email: payload.email } as unknown as AuthUser;
  }, []);

  const setAuth = useCallback((token: string, user: AuthUser) => {
    setAccessToken(token);
    setUser(user);
  }, [setUser]);

  const logout = useCallback(async () => {
    try {
      if (accessToken) {
        await apiLogout(accessToken);
      }
      toast.success("Logged out successfully");
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, [accessToken, setUser]);

  const updateProfile = useCallback(
    async (payload: UpdateProfilePayload) => {
      if (!accessToken) {
        throw new Error("No access token available");
      }
      const result = await apiUpdateProfile(accessToken, payload);
      setUser(result.user);
      return result.user;
    },
    [accessToken],
  );

  const changeProfilePhoto = useCallback(
    async (file: File) => {
      if (!accessToken) {
        throw new Error("No access token available");
      }
      const result = await apiUploadProfilePhoto(accessToken, file);
      setUser(result.user);
      return result.user;
    },
    [accessToken],
  );

  const requestEmailChange = useCallback(
    async (newEmail: string) => {
      if (!accessToken) {
        throw new Error("No access token available");
      }
      return apiRequestEmailChange(accessToken, newEmail);
    },
    [accessToken],
  );

  const verifyEmailChange = useCallback(
    async (newEmail: string, code: string) => {
      if (!accessToken) {
        throw new Error("No access token available");
      }
      const result = await apiVerifyEmailChange(accessToken, newEmail, code);
      if (result.accessToken) {
        setAccessToken(result.accessToken);
      }
      setUser(result.user);
      return result.user;
    },
    [accessToken],
  );

  const changePassword = useCallback(
    async (payload: {
      current_password: string;
      new_password: string;
      confirm_password: string;
    }) => {
      if (!accessToken) {
        throw new Error("No access token available");
      }
      const result = await apiChangePassword(accessToken, payload);
      // The backend reissues a token pair for THIS device (other devices
      // are signed out), so refresh the in-memory access token.
      if (result.accessToken) {
        setAccessToken(result.accessToken);
      }
      return result;
    },
    [accessToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isBootstrapping,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
      changeProfilePhoto,
      requestEmailChange,
      verifyEmailChange,
      changePassword,
      setAuth,
    }),
    [
      user,
      accessToken,
      isBootstrapping,
      login,
      register,
      logout,
      refreshUser,
      updateProfile,
      changeProfilePhoto,
      requestEmailChange,
      verifyEmailChange,
      changePassword,
      setAuth,
    ],
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
