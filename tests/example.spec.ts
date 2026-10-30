import { test, expect } from "@playwright/test";
import { healingLocator } from "../src/healing/healingLocator.js";

/**
 * Demo test for the self-healing locator.
 * Requires a running Ollama server with the configured model pulled, plus
 * internet access (the local model is called when the primary selector fails).
 *
 * Run it with: npm test -- example.spec.ts
 */
test("self-healing locator finds the submit button even when the selector changes", async ({
  page,
}) => {
  // Public practice page with a real form (the-internet.herokuapp.com).
  await page.goto("https://the-internet.herokuapp.com/login");

  // Deliberately wrong selector to force healing.
  const submitButton = await healingLocator(
    page,
    "button.this-selector-does-not-exist",
    "the button that submits the login form"
  );

  await expect(submitButton).toBeVisible();
});
