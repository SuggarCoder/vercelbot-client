"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import type { ChatDetailResponse, ModelsResponse } from "@/lib/central/contracts";
import { centralSWRFetcher } from "@/lib/central/client";
import { getStoredChatModel } from "@/lib/chat-preferences";
import { generateUUID, convertToUIMessages } from "@/lib/utils";

export function NewChatRoute() {
  const chatId = useMemo(() => generateUUID(), []);
  const { data: modelsResponse } = useSWR<ModelsResponse>(
    "/models",
    (path: string) => centralSWRFetcher<ModelsResponse>(path),
  );

  const initialChatModel =
    getStoredChatModel() ??
    modelsResponse?.models[0]?.id ??
    DEFAULT_CHAT_MODEL;

  return (
    <>
      <Chat
        autoResume={false}
        id={chatId}
        initialChatModel={initialChatModel}
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
        key={chatId}
      />
      <DataStreamHandler />
    </>
  );
}

export function ExistingChatRoute({ chatId }: { chatId: string }) {
  const { data, error, isLoading } = useSWR<ChatDetailResponse>(
    `/chat/detail?id=${encodeURIComponent(chatId)}`,
    (path: string) => centralSWRFetcher<ChatDetailResponse>(path),
  );
  const { data: modelsResponse } = useSWR<ModelsResponse>(
    "/models",
    (path: string) => centralSWRFetcher<ModelsResponse>(path),
  );

  if (isLoading) {
    return <div className="flex h-dvh" />;
  }

  if (error || !data) {
    return <div className="flex h-dvh items-center justify-center">Chat not found.</div>;
  }

  const initialChatModel =
    getStoredChatModel() ??
    modelsResponse?.models[0]?.id ??
    DEFAULT_CHAT_MODEL;

  return (
    <>
      <Chat
        autoResume={true}
        id={data.chat.id}
        initialChatModel={initialChatModel}
        initialMessages={convertToUIMessages(data.messages)}
        initialVisibilityType={data.chat.visibility}
        isReadonly={false}
        key={`${data.chat.id}-${data.messages.length}`}
      />
      <DataStreamHandler />
    </>
  );
}
