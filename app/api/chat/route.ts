import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

// Map model IDs to Vercel AI Gateway provider-prefixed IDs.
// Set AI_GATEWAY_BASE_URL to use Vercel AI Gateway (https://ai-gateway.vercel.sh/v1)
// or any OpenAI-compatible proxy that supports multi-provider routing.
// Falls back to direct OpenAI API when the env var is absent.
function getProviderModelId(modelId: string): string {
  if (!process.env.AI_GATEWAY_BASE_URL) return modelId;

  if (modelId.startsWith("gpt") || modelId.startsWith("o3") || modelId.startsWith("o4")) {
    return `openai/${modelId}`;
  }
  if (modelId.startsWith("claude")) {
    return `anthropic/${modelId}`;
  }
  if (modelId.startsWith("gemini")) {
    return `google/${modelId}`;
  }
  if (modelId.startsWith("deepseek")) {
    return `deepseek/${modelId}`;
  }
  if (modelId.startsWith("mistral")) {
    return `mistral/${modelId}`;
  }
  return modelId;
}

export async function POST(request: Request) {
  const { messages, model = "gpt-4.1" } = await request.json() as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    model?: string;
  };

  const openai = createOpenAI({
    apiKey: process.env.AI_GATEWAY_TOKEN ?? process.env.OPENAI_API_KEY ?? "",
    baseURL: process.env.AI_GATEWAY_BASE_URL,
  });

  const result = streamText({
    model: openai(getProviderModelId(model)),
    messages,
    system:
      "You are SwarmAgents, an expert AI coding assistant. Help the user plan, implement, review, and ship software. Be concise and practical.",
  });

  return result.toTextStreamResponse();
}
