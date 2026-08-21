import { readFileSync } from "node:fs";
import type { PlaywrightJsonFailure } from "./types.js";

/**
 * Playwright's built-in JSON reporter (`--reporter=json`) produces a tree of
 * suites -> specs -> tests -> results. Esta función recorre ese árbol y
 * extrae solo los tests que terminaron en estado "failed" o "timedOut",
 * junto con su mensaje de error, para mandarlos a triage.
 *
 * Genera el archivo de entrada con:
 *   npx playwright test --reporter=json > examples/sample-results.json
 */
export function extractFailures(jsonReportPath: string): PlaywrightJsonFailure[] {
  const raw = readFileSync(jsonReportPath, "utf-8");
  const report = JSON.parse(raw);
  const failures: PlaywrightJsonFailure[] = [];

  function walkSuite(suite: any, filePath: string) {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const lastResult = test.results?.[test.results.length - 1];
        if (!lastResult) continue;
        if (lastResult.status === "failed" || lastResult.status === "timedOut") {
          failures.push({
            testTitle: spec.title,
            filePath: filePath || spec.file || "unknown",
            errorMessage: lastResult.error?.message ?? "Sin mensaje de error capturado",
            errorStack: lastResult.error?.stack,
            retries: test.results.length - 1,
          });
        }
      }
    }
    for (const nested of suite.suites ?? []) {
      walkSuite(nested, filePath || suite.file);
    }
  }

  for (const suite of report.suites ?? []) {
    walkSuite(suite, suite.file);
  }

  return failures;
}
