import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { askForText } from "../anthropicClient.js";

/**
 * Usage:
 *   npm run generate-test -- examples/sample-user-story.md
 *
 * Reads a user story in markdown/plain text and generates a Playwright
 * `.spec.ts` file following Page Object Model conventions, in
 * tests/generated/. The file is ALWAYS generated as a draft for human
 * review — it is never run or committed automatically.
 *
 * This is a deliberately simple MVP: it doesn't know your app's real DOM,
 * so the selectors it generates are placeholders with explicit TODOs.
 * The value is in solving the "blank page problem": starting from a
 * complete structure (arrange/act/assert, descriptive test names, edge
 * cases) instead of an empty file.
 */

const SYSTEM_CONVENTIONS = `ALWAYS generate Playwright tests in TypeScript following these conventions:
- Use @playwright/test (import { test, expect } from "@playwright/test").
- Use Page Object Model: if the story warrants it, define a simple Page Object class with action methods.
- Name tests after the expected behavior, not the implementation.
- Cover the happy path AND at least one edge or error case if the story suggests it.
- Mark each selector with a "// TODO: verify real selector" comment, since you don't know the app's real DOM.
- Don't invent real URLs; use a BASE_URL constant at the top with a placeholder.
- Write code comments and variable/function names in English.`;

async function generateFromStory(storyText: string): Promise<string> {
  const code = await askForText(
    `Generate a complete Playwright test file (.spec.ts) for this user story:\n\n${storyText}\n\nReturn ONLY the TypeScript code, with no extra explanation and no markdown fences.`,
    SYSTEM_CONVENTIONS
  );
  return code.replace(/^```(typescript|ts)?\n?|```$/gm, "").trim();
}

async function main() {
  const storyPath = process.argv[2];
  if (!storyPath) {
    console.error("Usage: npm run generate-test -- <path-to-user-story.md>");
    process.exit(1);
  }

  const storyText = readFileSync(storyPath, "utf-8");
  console.log(`Generating test from: ${storyPath}...`);

  const code = await generateFromStory(storyText);

  const outDir = "tests/generated";
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const baseName = path.basename(storyPath, path.extname(storyPath));
  const outPath = path.join(outDir, `${baseName}.spec.ts`);
  writeFileSync(outPath, code + "\n", "utf-8");

  console.log(`\nDraft generated at: ${outPath}`);
  console.log("Review it before running: selectors are placeholders (see TODOs).");
}

main().catch((err) => {
  console.error("Error generating the test:", err);
  process.exit(1);
});
