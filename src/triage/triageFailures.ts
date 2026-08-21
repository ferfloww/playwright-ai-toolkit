import { writeFileSync } from "node:fs";
import { askForJson } from "../anthropicClient.js";
import { extractFailures } from "./extractFailures.js";
import type { PlaywrightJsonFailure, TriageResult } from "./types.js";

/**
 * Uso:
 *   npm run triage -- path/al/results.json
 *
 * Lee un reporte JSON de Playwright, manda todos los fallos en UNA sola
 * llamada a Claude (batch, para no gastar de más), y devuelve para cada uno:
 * categoría (flaky / real_bug / broken_selector / environment_issue),
 * confianza, razonamiento breve y acción sugerida.
 *
 * Pensado para correr como paso final de un pipeline de CI: en vez de que
 * un humano abra 40 tests fallidos uno por uno, el reporte llega ya
 * priorizado. NO reemplaza el juicio humano — el campo "confidence" está
 * ahí justo para señalar qué casos revisar a mano primero.
 */

function buildPrompt(failures: PlaywrightJsonFailure[]): string {
  return `Eres un ingeniero de QA senior revisando fallos de una suite de Playwright en CI.
Para cada fallo de la lista, clasifícalo en una de estas categorías:

- "flaky": el error sugiere una condición de carrera, timing, o timeout aislado sin causa funcional clara.
- "real_bug": el error apunta a un problema real de la aplicación (assertion de negocio fallida, dato incorrecto, status code de error, etc).
- "broken_selector": el error es de tipo "element not found" / "locator resolved to 0 elements" y sugiere que el selector quedó desactualizado por un cambio de UI.
- "environment_issue": el error sugiere un problema de infraestructura/entorno (red, credenciales, servicio caído, timeout de navegación completa).
- "unknown": si no hay suficiente información para decidir.

Responde SOLO con un array JSON (sin texto adicional, sin markdown), donde cada elemento tiene:
{
  "testTitle": string,
  "category": "flaky" | "real_bug" | "broken_selector" | "environment_issue" | "unknown",
  "confidence": "high" | "medium" | "low",
  "reasoning": string (1-2 frases, en español),
  "suggestedAction": string (1 frase concreta y accionable, en español)
}

Fallos a analizar:
${JSON.stringify(failures, null, 2)}`;
}

function toMarkdownReport(results: TriageResult[]): string {
  const byCategory: Record<string, TriageResult[]> = {};
  for (const r of results) {
    byCategory[r.category] ??= [];
    byCategory[r.category].push(r);
  }

  const order = ["real_bug", "broken_selector", "flaky", "environment_issue", "unknown"];
  const labels: Record<string, string> = {
    real_bug: "🔴 Bugs reales (revisar primero)",
    broken_selector: "🟠 Selectors rotos",
    flaky: "🟡 Tests flaky",
    environment_issue: "🔵 Problemas de entorno",
    unknown: "⚪ Sin clasificar",
  };

  let md = `# Reporte de triage automático\n\nTotal de fallos analizados: ${results.length}\n\n`;
  for (const cat of order) {
    const items = byCategory[cat];
    if (!items?.length) continue;
    md += `## ${labels[cat]} (${items.length})\n\n`;
    for (const item of items) {
      md += `### ${item.testTitle}\n`;
      md += `- **Confianza:** ${item.confidence}\n`;
      md += `- **Razonamiento:** ${item.reasoning}\n`;
      md += `- **Acción sugerida:** ${item.suggestedAction}\n\n`;
    }
  }
  return md;
}

async function main() {
  const inputPath = process.argv[2] ?? "examples/sample-results.json";
  console.log(`Leyendo fallos de: ${inputPath}`);

  const failures = extractFailures(inputPath);
  if (failures.length === 0) {
    console.log("No se encontraron tests fallidos en el reporte. Nada que triagear.");
    return;
  }
  console.log(`Encontrados ${failures.length} fallo(s). Consultando a Claude...`);

  const results = await askForJson<TriageResult[]>(buildPrompt(failures));

  const markdown = toMarkdownReport(results);
  writeFileSync("triage-report.md", markdown, "utf-8");

  console.log("\nResumen:");
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.category] = (counts[r.category] ?? 0) + 1;
  for (const [cat, count] of Object.entries(counts)) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log("\nReporte completo escrito en triage-report.md");
}

main().catch((err) => {
  console.error("Error en triage:", err);
  process.exit(1);
});
