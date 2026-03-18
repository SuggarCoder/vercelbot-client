"use client";

import type { CentralAuthResponse } from "@/lib/central/contracts";

export type AuthSession = CentralAuthResponse | null;

const STORAGE_KEY = "chatbot-auth-session";

let authSession: AuthSession = null;
let hydrated = false;
let refreshPromise: Promise<AuthSession> | null = null;

const listeners = new Set<(session: AuthSession) => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener(authSession);
  }
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function persistSession(session: AuthSession) {
  if (!canUseStorage()) {
    return;
  }

  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function getAuthSession() {
  return authSession;
}

export function getAccessToken() {
  return authSession?.accessToken ?? null;
}

export function getRefreshToken() {
  return authSession?.refreshToken ?? null;
}

export function getExpiresAt() {
  return authSession?.expiresAt ?? null;
}

export function isAuthHydrated() {
  return hydrated;
}

export function hydrateAuthSession() {
  if (!canUseStorage() || hydrated) {
    return authSession;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      authSession = JSON.parse(stored) as CentralAuthResponse;
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      authSession = null;
    }
  }

  hydrated = true;
  notifyListeners();

  return authSession;
}

export function setAuthSession(session: AuthSession) {
  authSession = session;
  hydrated = true;
  persistSession(session);
  notifyListeners();
}

export function clearAuthSession() {
  setAuthSession(null);
}

export function subscribeAuthSession(listener: (session: AuthSession) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listenToStorageChanges() {
  if (!canUseStorage()) {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }

    if (!event.newValue) {
      authSession = null;
      notifyListeners();
      return;
    }

    try {
      authSession = JSON.parse(event.newValue) as CentralAuthResponse;
      notifyListeners();
    } catch {
      authSession = null;
      notifyListeners();
    }
  };

  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function getRefreshPromise() {
  return refreshPromise;
}

export function setRefreshPromise(promise: Promise<AuthSession> | null) {
  refreshPromise = promise;
}
