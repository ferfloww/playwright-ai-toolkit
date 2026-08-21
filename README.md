# Playwright AI Toolkit

Tres herramientas MVP que aplican IA (Claude) a problemas reales de testing automatizado con [Playwright](https://playwright.dev/): triage de fallos en CI, self-healing de selectors, y generación de tests desde user stories.

No son un framework completo — son puntos de partida honestos, pensados para extenderse en un proyecto real. Cada uno resuelve un problema concreto del día a día de QA/SDET.

## ¿Por qué existe esto?

En CI, los tests fallan por razones muy distintas (bug real, flakiness, UI que cambió, entorno caído) y alguien tiene que abrir cada uno para saber cuál es cuál. Estas tres herramientas usan un LLM para reducir ese trabajo manual, siempre dejando la decisión final a un humano — ninguna de las tres modifica código de producción ni de tests de forma automática y silenciosa.

## Instalación

```bash
git clone <tu-fork-de-este-repo>
cd playwright-ai-toolkit
npm install
npx playwright install chromium
cp .env.example .env
# Edita .env y pon tu ANTHROPIC_API_KEY (https://console.anthropic.com/settings/keys)
```

## 1. Triage automático de fallos (`src/triage`)

Lee el reporte JSON de Playwright y clasifica cada fallo en `flaky`, `real_bug`, `broken_selector` o `environment_issue`, con razonamiento y acción sugerida. Genera `triage-report.md`.

```bash
# Genera un reporte real de tu suite:
npx playwright test --reporter=json > test-results/results.json
npm run triage -- test-results/results.json

# O prueba con el ejemplo incluido:
npm run triage -- examples/sample-results.json
```

Pensado para correr como último paso del pipeline de CI (ver `.github/workflows/ci.yml`): en vez de que alguien abra 40 tests fallidos uno por uno, el reporte llega ya priorizado, con los bugs reales primero.

## 2. Self-healing selectors (`src/healing`)

`healingLocator(page, selector, description)` intenta el selector normal primero. Si falla, le manda a Claude el HTML actual de la página + una descripción en lenguaje natural del elemento, y usa el selector que sugiera **solo para esa ejecución** — nunca reescribe tu código automáticamente.

Cada intento de healing (haya funcionado o no) queda registrado en `healing-log.json`, para que el equipo revise y decida si actualizar el selector real en el código fuente.

```ts
import { healingLocator } from "./src/healing/healingLocator.js";

const button = await healingLocator(
  page,
  "#submit-btn", // selector que se rompió
  "el botón para enviar el formulario de login" // descripción para la IA
);
await button.click();
```

Test de demostración (contra una página de práctica pública):

```bash
npm test -- example.spec.ts
```

**Por qué no hace auto-fix silencioso:** un selector que "ya no encuentra nada" a veces es la señal correcta de un bug real (ej. un botón que desapareció por error). Auto-reparar sin dejar rastro escondería justo el tipo de regresión que el test debía atrapar.

## 3. Generación de tests desde user stories (`src/generation`)

Toma una user story en markdown y genera un borrador de `.spec.ts` siguiendo Page Object Model, con casos happy path + edge case, y TODOs explícitos donde los selectors son placeholders (el generador no conoce el DOM real de tu app).

```bash
npm run generate-test -- examples/sample-user-story.md
# -> genera tests/generated/sample-user-story.spec.ts
```

Resuelve el "blank page problem": partir de una estructura completa en vez de un archivo vacío. El output SIEMPRE debe revisarse antes de correrse o commitearse.

## Estructura del repo

```
src/
  anthropicClient.ts     # cliente compartido del SDK de Anthropic
  triage/                # módulo 1
  healing/                # módulo 2
  generation/              # módulo 3
examples/                 # inputs de ejemplo para probar cada módulo
tests/                    # tests Playwright reales, incluye demo de healing
.github/workflows/ci.yml  # pipeline de ejemplo con triage automático
```

## Limitaciones honestas (léelo antes de usarlo en producción)

- El triage y el healing dependen de la calidad del HTML/errores que reciben — en apps muy dinámicas (SPAs con mucho estado en memoria) la precisión baja.
- La generación de tests produce selectors placeholder, no selectors reales — siempre necesita revisión humana.
- Cada llamada consume tokens de la API de Anthropic; en una suite grande, considera batchear (el módulo de triage ya lo hace) para controlar costo.
- Esto es un punto de partida, no una librería mantenida con versionado semántico ni tests exhaustivos de sí misma.

## Licencia

MIT — úsalo, modifícalo, adáptalo a tu stack.
