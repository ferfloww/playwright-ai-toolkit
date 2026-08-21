import { test, expect } from "@playwright/test";
import { healingLocator } from "../src/healing/healingLocator.js";

/**
 * Test de demostración del self-healing locator.
 * Requiere ANTHROPIC_API_KEY configurada y conexión a internet
 * (llama a la API de Claude cuando el selector primario falla).
 *
 * Correrlo con: npm test -- example.spec.ts
 */
test("el self-healing locator encuentra el botón de submit aunque el selector cambie", async ({
  page,
}) => {
  // Página de práctica pública con un formulario real (the-internet.herokuapp.com).
  await page.goto("https://the-internet.herokuapp.com/login");

  // Selector deliberadamente incorrecto para forzar el healing.
  const submitButton = await healingLocator(
    page,
    "button.this-selector-does-not-exist",
    "el botón para enviar el formulario de login"
  );

  await expect(submitButton).toBeVisible();
});
