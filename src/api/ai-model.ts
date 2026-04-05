import type { Bindings } from "./index";

// @cloudflare/workers-types doesn't include these models yet.
// Cast once here; callers use typed wrapper functions.
const EMBEDDING_MODEL_NAME = "@cf/baai/bge-m3";
const TEXT_MODEL_NAME = "@cf/meta/llama-3.1-8b-instruct";

type AiRunner = {
  run(
    model: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
};

function toRunner(ai: Bindings["AI"]): AiRunner {
  // biome-ignore lint/suspicious/noExplicitAny: Ai type lacks newer models
  return ai as any;
}

export async function runTextModel(
  ai: Bindings["AI"],
  messages: { role: string; content: string }[],
): Promise<string> {
  const result = await toRunner(ai).run(TEXT_MODEL_NAME, { messages });
  return typeof result.response === "string" ? result.response : "";
}

export async function runEmbeddingModel(
  ai: Bindings["AI"],
  texts: string[],
): Promise<number[][] | null> {
  const result = await toRunner(ai).run(EMBEDDING_MODEL_NAME, { text: texts });
  return Array.isArray(result.data) ? (result.data as number[][]) : null;
}
