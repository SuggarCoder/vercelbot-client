"use client";

import { ChatbotError, type ErrorCode } from "@/lib/errors";
import {
  clearAuthSession,
  getAccessToken,
  getExpiresAt,
  getAuthSession,
  getRefreshPromise,
  getRefreshToken,
  hydrateAuthSession,
  setAuthSession,
  setRefreshPromise,
} from "@/lib/auth/session";
import type {
  CentralAuthResponse,
  ChatDetailResponse,
  ChatHistoryResponse,
  ChatRequestBody,
  Document,
  ModelsResponse,
  Suggestion,
  Vote,
  VisibilityType,
} from "./contracts";

const DEFAULT_API_BASE_URL = "/api";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function joinApiBase(baseUrl: string, path: string) {
  const trimmedBase = trimTrailingSlash(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (trimmedBase.startsWith("http://") || trimmedBase.startsWith("https://")) {
    return `${trimmedBase}${normalizedPath}`;
  }

  if (
    normalizedPath === trimmedBase ||
    normalizedPath.startsWith(`${trimmedBase}/`) ||
    normalizedPath.startsWith(`${trimmedBase}?`)
  ) {
    return normalizedPath;
  }

  return `${trimmedBase}${normalizedPath}`;
}

export function getCentralApiBaseUrl() {
  const configured = import.meta.env.VITE_CENTRAL_API_BASE_URL?.trim();

  if (!configured) {
    return DEFAULT_API_BASE_URL;
  }

  return trimTrailingSlash(configured);
}

function normalizePath(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    const url = new URL(path);

    if (typeof window !== "undefined" && url.origin === window.location.origin) {
      return joinApiBase(getCentralApiBaseUrl(), `${url.pathname}${url.search}`);
    }

    return path;
  }

  return joinApiBase(getCentralApiBaseUrl(), path);
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function toChatbotError(payload: {
  code?: string;
  message?: string;
  cause?: string;
}, status: number) {
  if (payload.code) {
    const error = new ChatbotError(payload.code as ErrorCode, payload.cause);
    error.message = payload.message ?? error.message;
    return error;
  }

  if (status === 401) {
    const error = new ChatbotError("unauthorized:auth");
    error.message = payload.message ?? error.message;
    return error;
  }

  if (status === 403) {
    const error = new ChatbotError("forbidden:auth");
    error.message = payload.message ?? error.message;
    return error;
  }

  if (status === 404) {
    const error = new ChatbotError("not_found:chat");
    error.message = payload.message ?? error.message;
    return error;
  }

  if (status === 429) {
    const error = new ChatbotError("rate_limit:chat");
    error.message = payload.message ?? error.message;
    return error;
  }

  if (status >= 500) {
    const error = new ChatbotError("offline:chat");
    error.message = payload.message ?? error.message;
    return error;
  }

  const error = new ChatbotError("bad_request:api");
  error.message = payload.message ?? error.message;
  return error;
}

async function ensureResponseOk(response: Response) {
  if (response.ok) {
    return response;
  }

  const payload = await parseJsonSafe(response);
  throw toChatbotError(payload ?? {}, response.status);
}

const ACCESS_TOKEN_REFRESH_BUFFER_MS = 30_000;

async function ensureFreshAccessToken() {
  hydrateAuthSession();

  const accessToken = getAccessToken();
  const expiresAt = getExpiresAt();
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return accessToken;
  }

  if (
    accessToken &&
    expiresAt &&
    expiresAt > Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS
  ) {
    return accessToken;
  }

  const refreshed = await refreshCentralAuth();
  return refreshed?.accessToken ?? getAccessToken();
}

export async function publicCentralFetch(path: string, init?: RequestInit) {
  const response = await fetch(normalizePath(path), {
    ...init,
    headers: new Headers(init?.headers),
    cache: "no-store",
  });

  return ensureResponseOk(response);
}

export async function publicCentralJson<T>(path: string, init?: RequestInit) {
  const response = await publicCentralFetch(path, init);
  return response.json() as Promise<T>;
}

export async function refreshCentralAuth() {
  hydrateAuthSession();

  const existing = getRefreshPromise();
  if (existing) {
    return existing;
  }

  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    clearAuthSession();
    return null;
  }

  const promise = (async () => {
    try {
      const refreshed = await publicCentralJson<CentralAuthResponse>("/auth/refresh", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      setAuthSession(refreshed);
      return refreshed;
    } catch {
      clearAuthSession();
      return null;
    } finally {
      setRefreshPromise(null);
    }
  })();

  setRefreshPromise(promise);
  return promise;
}

type CentralFetchOptions = RequestInit & {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
};

export async function centralFetch(
  path: string,
  init: CentralFetchOptions = {},
): Promise<Response> {
  hydrateAuthSession();

  const headers = new Headers(init.headers);
  const useAuth = init.auth ?? true;

  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (useAuth) {
    const accessToken = await ensureFreshAccessToken();

    if (accessToken) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }
  }

  const response = await fetch(normalizePath(path), {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status !== 401 || useAuth === false || init.retryOnUnauthorized === false) {
    return response;
  }

  const refreshed = await refreshCentralAuth();
  if (!refreshed?.accessToken) {
    return response;
  }

  const retryHeaders = new Headers(init.headers);

  if (init.body && !retryHeaders.has("content-type")) {
    retryHeaders.set("content-type", "application/json");
  }

  retryHeaders.set("authorization", `Bearer ${refreshed.accessToken}`);

  return fetch(normalizePath(path), {
    ...init,
    headers: retryHeaders,
    cache: "no-store",
  });
}

export async function centralJson<T>(path: string, init?: CentralFetchOptions) {
  const response = await centralFetch(path, init);
  await ensureResponseOk(response);
  return response.json() as Promise<T>;
}

export function login(email: string, password: string) {
  return publicCentralJson<CentralAuthResponse>("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function register(email: string, password: string) {
  return publicCentralJson<CentralAuthResponse>("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function getModels() {
  return publicCentralJson<ModelsResponse>("/models");
}

export function getHistory(params: {
  limit: number;
  startingAfter?: string | null;
  endingBefore?: string | null;
}) {
  const searchParams = new URLSearchParams({ limit: String(params.limit) });

  if (params.startingAfter) {
    searchParams.set("starting_after", params.startingAfter);
  }

  if (params.endingBefore) {
    searchParams.set("ending_before", params.endingBefore);
  }

  return centralJson<ChatHistoryResponse>(`/history?${searchParams.toString()}`);
}

export function deleteHistory() {
  return centralJson<{ deletedCount: number }>("/history", { method: "DELETE" });
}

export function getChatDetail(chatId: string) {
  return centralJson<ChatDetailResponse>(
    `/chat/detail?id=${encodeURIComponent(chatId)}`,
  );
}

export function deleteChat(chatId: string) {
  return centralFetch(`/chat?id=${encodeURIComponent(chatId)}`, {
    method: "DELETE",
  }).then(ensureResponseOk);
}

export function patchChatVisibility(chatId: string, visibility: VisibilityType) {
  return centralJson<{ ok: true }>("/chat/visibility", {
    method: "PATCH",
    body: JSON.stringify({ chatId, visibility }),
  });
}

export function getVotes(chatId: string) {
  return centralJson<Vote[]>(`/vote?chatId=${encodeURIComponent(chatId)}`);
}

export function patchVote(args: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  return centralFetch("/vote", {
    method: "PATCH",
    body: JSON.stringify(args),
  }).then(ensureResponseOk);
}

export function getDocument(documentId: string) {
  return centralJson<Document[]>(`/document?id=${encodeURIComponent(documentId)}`);
}

export function saveDocument(args: {
  documentId: string;
  title: string;
  content: string;
  kind: string;
}) {
  return centralJson<Document>(`/document?id=${encodeURIComponent(args.documentId)}`, {
    method: "POST",
    body: JSON.stringify({
      title: args.title,
      content: args.content,
      kind: args.kind,
    }),
  });
}

export function deleteDocumentAfter(documentId: string, timestamp: Date | string) {
  const encodedTimestamp =
    timestamp instanceof Date ? timestamp.toISOString() : timestamp;

  return centralFetch(
    `/document?id=${encodeURIComponent(documentId)}&timestamp=${encodeURIComponent(encodedTimestamp)}`,
    { method: "DELETE" },
  ).then(ensureResponseOk);
}

export function getSuggestions(documentId: string) {
  return centralJson<Suggestion[]>(
    `/suggestions?documentId=${encodeURIComponent(documentId)}`,
  );
}

export function deleteTrailingMessages(id: string) {
  return centralJson<{ ok: true }>("/messages/trailing", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

export function createChatStream(body: ChatRequestBody, signal?: AbortSignal) {
  return centralFetch("/chat", {
    method: "POST",
    body: JSON.stringify(body),
    signal,
  }).then(ensureResponseOk);
}

export function authAwareFetch(input: RequestInfo | URL, init?: RequestInit) {
  const path =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return centralFetch(path, init);
}

export function centralSWRFetcher<T>(path: string) {
  return centralJson<T>(path);
}

export function getStoredUser() {
  return getAuthSession()?.user ?? null;
}
