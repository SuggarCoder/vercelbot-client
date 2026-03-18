import type { CentralModel } from "@/lib/central/contracts";

export const DEFAULT_CHAT_MODEL = "qwen";

export type ChatModel = CentralModel;

export const chatModels: ChatModel[] = [
  {
    id: "qwen",
    name: "QWEN",
    provider: "qwen",
    description: "Qwen3 Next 80B A3B Instruct for general chat and tool use",
    supportsReasoning: false,
    supportsTools: true,
  },
  {
    id: "qwen-thinking",
    name: "QWEN Thinking",
    provider: "qwen",
    description: "Qwen3 Next 80B A3B Thinking for deeper reasoning with tool use",
    supportsReasoning: true,
    supportsTools: true,
  },
  {
    id: "kimi",
    name: "KIMI",
    provider: "kimi",
    description: "Kimi K2 for long-context conversations and tool use",
    supportsReasoning: false,
    supportsTools: true,
  },
  {
    id: "kimi-thinking",
    name: "KIMI Thinking",
    provider: "kimi",
    description: "Kimi K2 Thinking for multi-step reasoning and tool use",
    supportsReasoning: true,
    supportsTools: true,
  },
  {
    id: "deepseek",
    name: "DEEPSEEK",
    provider: "deepseek",
    description: "DeepSeek V3.2 for coding, analysis, and tool use",
    supportsReasoning: false,
    supportsTools: true,
  },
  {
    id: "deepseek-thinking",
    name: "DEEPSEEK Thinking",
    provider: "deepseek",
    description: "DeepSeek V3.2 Thinking for heavier reasoning with tool use",
    supportsReasoning: true,
    supportsTools: true,
  },
];

// Group models by provider for UI
export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
