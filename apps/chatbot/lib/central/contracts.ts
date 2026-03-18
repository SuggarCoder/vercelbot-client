import type {
  UIMessage,
  UIMessagePart,
} from "ai";
import type { ChatTools, CustomUIDataTypes } from "@/lib/types";

export type VisibilityType = "public" | "private";
export type ArtifactKind = "text" | "code" | "image" | "sheet";
export type UserType = "regular";

export type AuthUser = {
  id: string;
  email: string | null;
  type: UserType;
};

export type Chat = {
  id: string;
  createdAt: Date | string;
  title: string;
  userId: string;
  visibility: VisibilityType;
};

export type DBMessage = {
  id: string;
  chatId: string;
  role: string;
  parts: UIMessagePart<CustomUIDataTypes, ChatTools>[];
  attachments: unknown[];
  createdAt: Date | string;
};

export type Vote = {
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
};

export type Document = {
  id: string;
  createdAt: Date | string;
  title: string;
  content: string | null;
  kind: ArtifactKind;
  userId: string;
};

export type Suggestion = {
  id: string;
  documentId: string;
  documentCreatedAt: Date | string;
  originalText: string;
  suggestedText: string;
  description: string | null;
  isResolved: boolean;
  userId?: string;
  createdAt?: Date | string;
};

export type ChatDetailResponse = {
  chat: Chat;
  messages: DBMessage[];
};

export type ChatHistoryResponse = {
  chats: Chat[];
  hasMore: boolean;
};

export type CentralAuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type CentralModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  supportsReasoning: boolean;
  supportsTools: boolean;
};

export type ModelsResponse = {
  models: CentralModel[];
};

export type ChatRequestBody = {
  id: string;
  message?: UIMessage;
  messages?: UIMessage[];
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
};
