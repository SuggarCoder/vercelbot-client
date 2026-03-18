import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import type {
  LanguageModelV3FinishReason,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
} from "@ai-sdk/provider";
import { getResponseChunksByPrompt } from "@/tests/prompts/utils";

const mockUsage: LanguageModelV3Usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};
const stopReason = "stop" as unknown as LanguageModelV3FinishReason;

export const chatModel = new MockLanguageModelV3({
  doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
    finishReason: stopReason,
    usage: mockUsage,
    content: [{ type: "text", text: "Hello, world!" }],
    warnings: [],
  }),
  doStream: async ({ prompt }): Promise<LanguageModelV3StreamResult> => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: getResponseChunksByPrompt(prompt) as LanguageModelV3StreamPart[],
    }),
  }),
});

export const reasoningModel = new MockLanguageModelV3({
  doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
    finishReason: stopReason,
    usage: mockUsage,
    content: [{ type: "text", text: "Hello, world!" }],
    warnings: [],
  }),
  doStream: async ({ prompt }): Promise<LanguageModelV3StreamResult> => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: getResponseChunksByPrompt(
        prompt,
        true,
      ) as LanguageModelV3StreamPart[],
    }),
  }),
});

export const titleModel = new MockLanguageModelV3({
  doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
    finishReason: stopReason,
    usage: mockUsage,
    content: [{ type: "text", text: "This is a test title" }],
    warnings: [],
  }),
  doStream: async (): Promise<LanguageModelV3StreamResult> => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: [
        { id: "1", type: "text-start" },
        { id: "1", type: "text-delta", delta: "This is a test title" },
        { id: "1", type: "text-end" },
        {
          type: "finish",
          finishReason: stopReason,
          usage: mockUsage,
        },
      ] as LanguageModelV3StreamPart[],
    }),
  }),
});

export const artifactModel = new MockLanguageModelV3({
  doGenerate: async (): Promise<LanguageModelV3GenerateResult> => ({
    finishReason: stopReason,
    usage: mockUsage,
    content: [{ type: "text", text: "Hello, world!" }],
    warnings: [],
  }),
  doStream: async ({ prompt }): Promise<LanguageModelV3StreamResult> => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 50,
      initialDelayInMs: 100,
      chunks: getResponseChunksByPrompt(prompt) as LanguageModelV3StreamPart[],
    }),
  }),
});
