import "dotenv/config";

/**
 * Shared client for the toolkit's three tools, using a local model via
 * Ollama instead of the paid Anthropic API.
 * Requires `ollama serve` running and the model pulled (`ollama pull <model>`).
 */
const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
export const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1";

/**
 * Extracts the first JSON block (array or object) from a string, in case the
 * local model wraps it in explanations or markdown fences.
 */
function extractJsonBlock(raw: string): string {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) return cleaned;
  const endChar = cleaned[start] === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(endChar);
  return end === -1 ? cleaned : cleaned.slice(start, end + 1);
}

/**
 * Helper that asks the local model for a pure JSON response and parses it.
 * It doesn't use Ollama's `format: "json"` mode because that forces a
 * top-level object and breaks prompts that ask for an array.
 */
export async function askForJson<T>(prompt: string, maxTokens = 2000): Promise<T> {
  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: { num_predict: maxTokens },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama responded ${response.status}. Is \`ollama serve\` running and the model "${DEFAULT_MODEL}" pulled?`
    );
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const raw = data.message?.content ?? "";

  try {
    return JSON.parse(extractJsonBlock(raw)) as T;
  } catch (err) {
    throw new Error(
      `Could not parse the local model's response as JSON.\nRaw response:\n${raw}`
    );
  }
}

/**
 * Helper that asks the local model for free-form text (e.g. code), without forcing JSON.
 */
export async function askForText(
  prompt: string,
  system?: string,
  maxTokens = 2500
): Promise<string> {
  const messages = system
    ? [{ role: "system", content: system }, { role: "user", content: prompt }]
    : [{ role: "user", content: prompt }];

  const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages,
      stream: false,
      options: { num_predict: maxTokens },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Ollama responded ${response.status}. Is \`ollama serve\` running and the model "${DEFAULT_MODEL}" pulled?`
    );
  }

  const data = (await response.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}
