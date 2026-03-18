"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CentralAuthResponse } from "@/lib/central/contracts";
import {
  clearAuthSession,
  getAuthSession,
  hydrateAuthSession,
  listenToStorageChanges,
  setAuthSession,
  subscribeAuthSession,
} from "@/lib/auth/session";

type AuthContextValue = {
  session: CentralAuthResponse | null;
  isHydrated: boolean;
  isAuthenticated: boolean;
  setSession: (session: CentralAuthResponse | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<CentralAuthResponse | null>(
    getAuthSession(),
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setSessionState(hydrateAuthSession());
    setIsHydrated(true);

    const unsubscribe = subscribeAuthSession((nextSession) => {
      setSessionState(nextSession);
      setIsHydrated(true);
    });

    const stopListening = listenToStorageChanges();

    return () => {
      unsubscribe();
      stopListening();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isHydrated,
      isAuthenticated: Boolean(session?.accessToken),
      setSession: (nextSession) => setAuthSession(nextSession),
      logout: () => clearAuthSession(),
    }),
    [isHydrated, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
