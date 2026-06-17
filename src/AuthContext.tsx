import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface SessionData {
  token: string;
  userId: string;
  tenantId: string;
  restaurantId: string;
  restaurantName: string;
  email: string;
  role: string;
}

const STORAGE_KEY = "restaurant-pos-session";

interface AuthContextValue {
  session: SessionData | null;
  login: (session: SessionData, remember?: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  const rawLocal = window.localStorage.getItem(STORAGE_KEY);
  const raw = rawLocal ?? window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SessionData;
    if (
      !parsed?.token ||
      !parsed?.userId ||
      !parsed?.tenantId ||
      !parsed?.restaurantId ||
      !parsed?.restaurantName ||
      !parsed?.email ||
      !parsed?.role
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);

  useEffect(() => {
    setSession(loadSession());
  }, []);

  const value = useMemo(
    () => ({
      session,
      login: (nextSession: SessionData, remember = true) => {
        try {
          if (remember) {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
          } else {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
          }
        } catch {
          // ignore storage errors
        }
        setSession(nextSession);
      },
      logout: () => {
        window.localStorage.removeItem(STORAGE_KEY);
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}

export function getStoredSession(): SessionData | null {
  return loadSession();
}
