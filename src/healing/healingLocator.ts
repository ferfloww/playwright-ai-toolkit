import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Page, Locator } from "@playwright/test";
import { askForJson } from "../anthropicClient.js";

/**
 * "Self-healing selectors" MVP.
 *
 * Deliberate philosophy: this tool does NOT silently replace the selector in
 * your code (that's dangerous — it can hide real app regressions). Instead:
 *   1. It tries the normal primary selector.
 *   2. If that fails, it sends the AI model the page's current HTML plus a
 *      natural-language description of the target element.
 *   3. If the model proposes a selector that DOES resolve on the page, it
 *      uses it so the test can continue in this run...
 *   4. ...but records it in healing-log.json so a human can decide whether
 *      to update the selector in the source code.
 *
 * This way the test doesn't break on a cosmetic UI change, but the team
 * finds out and stays in control of the real code.
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
  // Trim the HTML to avoid wasting tokens: the body is usually enough and
  // avoids sending irrelevant <head>/scripts/styles.
  const html = await page.evaluate(() => document.body.innerHTML);
  const trimmedHtml = html.length > 12000 ? html.slice(0, 12000) + "...[truncated]" : html;

  const prompt = `You are an expert in web testing with Playwright.
A test was looking for an element described as: "${description}"
The original selector NO LONGER works (the UI probably changed).

Here is the current HTML of the page's <body>:
\`\`\`html
${trimmedHtml}
\`\`\`

Propose the BEST CSS or text selector (Playwright format, e.g. "button:has-text('Submit')" or "#submit-btn") that identifies the described element.
Respond ONLY with JSON (no markdown): { "selector": string, "reasoning": string }`;

  return askForJson<HealingSuggestion>(prompt, 500);
}

/**
 * Returns a usable Locator: the original one if it works, or an AI-"healed"
 * one if the original doesn't resolve in time. Throws if neither works.
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
      `[healing] Original selector not found: "${originalSelector}". Asking the AI model for a suggestion...`
    );
  }

  const suggestion = await suggestSelector(page, description);
  const healed = page.locator(suggestion.selector);

  let succeeded = false;
  try {
    await healed.waitFor({ state: "attached", timeout: timeoutMs });
    succeeded = true;
    console.warn(
      `[healing] Healed selector worked: "${suggestion.selector}" (${suggestion.reasoning})`
    );
  } catch {
    console.error(`[healing] The suggested selector didn't work either: "${suggestion.selector}"`);
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
      `Element "${description}" not found with either the original or the AI-suggested selector.`
    );
  }

  return healed;
}
