"use client";

const CHAT_MODEL_STORAGE_KEY = "chat-model";

export function getStoredChatModel() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(CHAT_MODEL_STORAGE_KEY);
}

export function setStoredChatModel(modelId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CHAT_MODEL_STORAGE_KEY, modelId);
}
