import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Page, Locator } from "@playwright/test";
import { askForJson } from "../anthropicClient.js";

/**
 * MVP de "self-healing selectors".
 *
 * Filosofía deliberada: esta herramienta NO reemplaza el selector en el
 * código de forma silenciosa (eso es peligroso — puede ocultar regresiones
 * reales de la app). En su lugar:
 *   1. Intenta el selector primario normal.
 *   2. Si falla, le pasa a Claude el HTML actual de la página + una
 *      descripción en lenguaje natural del elemento buscado.
 *   3. Si Claude propone un selector que SÍ resuelve en la página, lo usa
 *      para que el test pueda continuar en esta ejecución...
 *   4. ...pero deja constancia en healing-log.json para que un humano
 *      decida si actualizar el selector en el código fuente.
 *
 * Así el test no se cae por un cambio cosmético de UI, pero el equipo se
 * entera y mantiene control sobre el código real.
 */

interface HealingLogEntry {
  timestamp: string;
  description: string;
  originalSelector: string;
  healedSelector: string | null;
  succeeded: boolean;
}

interface HealingSuggestion {
  selector: string;
  reasoning: string;
}

function logHealingEvent(entry: HealingLogEntry) {
  const logPath = "healing-log.json";
  let existing: HealingLogEntry[] = [];
  if (existsSync(logPath)) {
    try {
      existing = JSON.parse(readFileSync(logPath, "utf-8"));
    } catch {
      existing = [];
    }
  }
  existing.push(entry);
  writeFileSync(logPath, JSON.stringify(existing, null, 2), "utf-8");
}

async function suggestSelector(page: Page, description: string): Promise<HealingSuggestion> {
  // Recortamos el HTML para no gastar de más en tokens: body completo suele
  // bastar y evita mandar <head>/scripts/estilos irrelevantes.
  const html = await page.evaluate(() => document.body.innerHTML);
  const trimmedHtml = html.length > 12000 ? html.slice(0, 12000) + "...[truncado]" : html;

  const prompt = `Eres un experto en testing web con Playwright.
Un test buscaba un elemento descrito como: "${description}"
El selector original ya NO funciona (probablemente cambió la UI).

Aquí está el HTML actual del <body> de la página:
\`\`\`html
${trimmedHtml}
\`\`\`

Propón el MEJOR selector CSS o de texto (formato Playwright, ej: "button:has-text('Enviar')" o "#submit-btn") que identifique el elemento descrito.
Responde SOLO con JSON (sin markdown): { "selector": string, "reasoning": string }`;

  return askForJson<HealingSuggestion>(prompt, 500);
}

/**
 * Devuelve un Locator utilizable: el original si funciona, o uno "sanado"
 * por IA si el original no resuelve a tiempo. Lanza si ninguno funciona.
 */
export async function healingLocator(
  page: Page,
  originalSelector: string,
  description: string,
  timeoutMs = 3000
): Promise<Locator> {
  const primary = page.locator(originalSelector);

  try {
    await primary.waitFor({ state: "attached", timeout: timeoutMs });
    return primary;
  } catch {
    console.warn(
      `[healing] Selector original no encontrado: "${originalSelector}". Pidiendo sugerencia a Claude...`
    );
  }

  const suggestion = await suggestSelector(page, description);
  const healed = page.locator(suggestion.selector);

  let succeeded = false;
  try {
    await healed.waitFor({ state: "attached", timeout: timeoutMs });
    succeeded = true;
    console.warn(
      `[healing] Selector sanado funcionó: "${suggestion.selector}" (${suggestion.reasoning})`
    );
  } catch {
    console.error(`[healing] El selector sugerido tampoco funcionó: "${suggestion.selector}"`);
  }

  logHealingEvent({
    timestamp: new Date().toISOString(),
    description,
    originalSelector,
    healedSelector: suggestion.selector,
    succeeded,
  });

  if (!succeeded) {
    throw new Error(
      `No se encontró el elemento "${description}" ni con el selector original ni con el sugerido por IA.`
    );
  }

  return healed;
}
