import { writeFileSync } from "node:fs";
import { askForJson } from "../anthropicClient.js";
import { extractFailures } from "./extractFailures.js";
import type { PlaywrightJsonFailure, TriageResult } from "./types.js";

/**
 * Usage:
 *   npm run triage -- path/to/results.json
 *
 * Reads a Playwright JSON report, sends all failures to the AI model in a
 * SINGLE call (batched, to keep costs down), and returns for each one:
 * category (flaky / real_bug / broken_selector / environment_issue),
 * confidence, brief reasoning, and a suggested action.
 *
 * Meant to run as the final step of a CI pipeline: instead of a human
 * opening 40 failed tests one by one, the report arrives already
 * prioritized. It does NOT replace human judgment — the "confidence" field
 * is there precisely to flag which cases to review by hand first.
 */

function buildPrompt(failures: PlaywrightJsonFailure[]): string {
  return `You are a senior QA engineer reviewing failures from a Playwright suite in CI.
Classify each failure in the list into one of these categories:

- "flaky": the error suggests a race condition, timing issue, or isolated timeout with no clear functional cause.
- "real_bug": the error points to a real application problem (failed business assertion, wrong data, error status code, etc).
- "broken_selector": the error is of the "element not found" / "locator resolved to 0 elements" kind and suggests the selector became outdated due to a UI change.
- "environment_issue": the error suggests an infrastructure/environment problem (network, credentials, service down, full navigation timeout).
- "unknown": if there isn't enough information to decide.

Respond ONLY with a JSON array (no extra text, no markdown), where each element has:
{
  "testTitle": string,
  "category": "flaky" | "real_bug" | "broken_selector" | "environment_issue" | "unknown",
  "confidence": "high" | "medium" | "low",
  "reasoning": string (1-2 sentences),
  "suggestedAction": string (1 concrete, actionable sentence)
}

Failures to analyze:
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
    real_bug: "🔴 Real bugs (review first)",
    broken_selector: "🟠 Broken selectors",
    flaky: "🟡 Flaky tests",
    environment_issue: "🔵 Environment issues",
    unknown: "⚪ Unclassified",
  };

  let md = `# Automated triage report\n\nTotal failures analyzed: ${results.length}\n\n`;
  for (const cat of order) {
    const items = byCategory[cat];
    if (!items?.length) continue;
    md += `## ${labels[cat]} (${items.length})\n\n`;
    for (const item of items) {
      md += `### ${item.testTitle}\n`;
      md += `- **Confidence:** ${item.confidence}\n`;
      md += `- **Reasoning:** ${item.reasoning}\n`;
      md += `- **Suggested action:** ${item.suggestedAction}\n\n`;
    }
  }
  return md;
}

async function main() {
  const inputPath = process.argv[2] ?? "examples/sample-results.json";
  console.log(`Reading failures from: ${inputPath}`);

  const failures = extractFailures(inputPath);
  if (failures.length === 0) {
    console.log("No failed tests found in the report. Nothing to triage.");
    return;
  }
  console.log(`Found ${failures.length} failure(s). Asking the AI model...`);

  const results = await askForJson<TriageResult[]>(buildPrompt(failures));

  const markdown = toMarkdownReport(results);
  writeFileSync("triage-report.md", markdown, "utf-8");

  console.log("\nSummary:");
  const counts: Record<string, number> = {};
  for (const r of results) counts[r.category] = (counts[r.category] ?? 0) + 1;
  for (const [cat, count] of Object.entries(counts)) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log("\nFull report written to triage-report.md");
}

main().catch((err) => {
  console.error("Triage error:", err);
  process.exit(1);
});
