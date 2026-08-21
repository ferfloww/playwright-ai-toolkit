import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { anthropic, DEFAULT_MODEL } from "../anthropicClient.js";

/**
 * Uso:
 *   npm run generate-test -- examples/sample-user-story.md
 *
 * Lee una user story en markdown/texto plano y genera un archivo
 * `.spec.ts` de Playwright siguiendo convenciones de Page Object Model,
 * en tests/generated/. El archivo se genera SIEMPRE como borrador para
 * revisión humana — nunca se corre ni se commitea automáticamente.
 *
 * Esto es un MVP deliberadamente simple: no conoce el DOM real de tu app,
 * así que los selectors que genera son placeholders con TODOs explícitos.
 * El valor está en ahorrar el "blank page problem": partir de una
 * estructura completa (arrange/act/assert, nombres de test descriptivos,
 * casos edge) en vez de un archivo vacío.
 */

const SYSTEM_CONVENTIONS = `Genera SIEMPRE tests de Playwright en TypeScript siguiendo estas convenciones:
- Usa @playwright/test (import { test, expect } from "@playwright/test").
- Usa Page Object Model: si la story lo justifica, define una clase Page Object simple con métodos de acción.
- Nombra los tests describiendo el comportamiento esperado, no la implementación.
- Cubre el happy path Y al menos un caso edge o de error si la story lo sugiere.
- Marca cada selector con un comentario "// TODO: verificar selector real" ya que no conoces el DOM real de la app.
- No inventes URLs reales; usa una constante BASE_URL al inicio con un placeholder.
- Comentarios de código en español, nombres de variables/funciones en inglés (convención del equipo).`;

async function generateFromStory(storyText: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2500,
    system: SYSTEM_CONVENTIONS,
    messages: [
      {
        role: "user",
        content: `Genera un archivo de test Playwright (.spec.ts) completo para esta user story:\n\n${storyText}\n\nDevuelve SOLO el código TypeScript, sin explicación adicional y sin fences de markdown.`,
      },
    ],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  const code = textBlock && "text" in textBlock ? textBlock.text : "";
  return code.replace(/^```(typescript|ts)?\n?|```$/gm, "").trim();
}

async function main() {
  const storyPath = process.argv[2];
  if (!storyPath) {
    console.error("Uso: npm run generate-test -- <ruta-a-user-story.md>");
    process.exit(1);
  }

  const storyText = readFileSync(storyPath, "utf-8");
  console.log(`Generando test a partir de: ${storyPath}...`);

  const code = await generateFromStory(storyText);

  const outDir = "tests/generated";
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const baseName = path.basename(storyPath, path.extname(storyPath));
  const outPath = path.join(outDir, `${baseName}.spec.ts`);
  writeFileSync(outPath, code + "\n", "utf-8");

  console.log(`\nBorrador generado en: ${outPath}`);
  console.log("Revísalo antes de correrlo: los selectors son placeholders (ver TODOs).");
}

main().catch((err) => {
  console.error("Error generando el test:", err);
  process.exit(1);
});
