import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

/**
 * Cliente compartido del SDK de Anthropic para las tres herramientas del toolkit.
 * Requiere ANTHROPIC_API_KEY en el entorno (ver .env.example).
 */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

/**
 * Helper para pedirle a Claude una respuesta que sea JSON puro y parsearla,
 * quitando fences de markdown por si el modelo los añade.
 */
export async function askForJson<T>(prompt: string, maxTokens = 2000): Promise<T> {
  const response = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";
  const cleaned = raw.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `No se pudo parsear la respuesta de Claude como JSON.\nRespuesta cruda:\n${raw}`
    );
  }
}
