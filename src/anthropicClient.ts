import "dotenv/config";

/**
 * Cliente compartido para las tres herramientas del toolkit, usando un modelo
 * local vía Ollama en vez de la API paga de Anthropic.
 * Requiere `ollama serve` corriendo y el modelo descargado (`ollama pull <modelo>`).
 */
const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
export const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1";

/**
 * Extrae el primer bloque JSON (array u objeto) de un texto, por si el modelo
 * local añade explicación o fences de markdown alrededor.
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
 * Helper para pedirle al modelo local una respuesta que sea JSON puro y parsearla.
 * No usa el modo `format: "json"` de Ollama porque este fuerza un objeto top-level
 * y rompe los prompts que piden un array.
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
      `Ollama respondió ${response.status}. ¿Está corriendo \`ollama serve\` y descargado el modelo "${DEFAULT_MODEL}"?`
    );
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const raw = data.message?.content ?? "";

  try {
    return JSON.parse(extractJsonBlock(raw)) as T;
  } catch (err) {
    throw new Error(
      `No se pudo parsear la respuesta del modelo local como JSON.\nRespuesta cruda:\n${raw}`
    );
  }
}

/**
 * Helper para pedirle al modelo local texto libre (ej. código), sin forzar JSON.
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
      `Ollama respondió ${response.status}. ¿Está corriendo \`ollama serve\` y descargado el modelo "${DEFAULT_MODEL}"?`
    );
  }

  const data = (await response.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}
