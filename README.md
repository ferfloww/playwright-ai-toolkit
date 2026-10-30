# Playwright AI Toolkit

Three MVP tools that apply AI (a local LLM via [Ollama](https://ollama.com)) to real automated-testing problems with [Playwright](https://playwright.dev/): CI failure triage, self-healing selectors, and test generation from user stories.

They're not a complete framework — they're honest starting points, meant to be extended in a real project. Each one solves a concrete, everyday QA/SDET problem.

## Why does this exist?

In CI, tests fail for very different reasons (a real bug, flakiness, a UI change, a broken environment) and someone has to open each one to figure out which is which. These three tools use an LLM to cut down that manual work, always leaving the final decision to a human — none of them modifies production or test code automatically and silently.

## Installation

```bash
git clone https://github.com/ferfloww/playwright-ai-toolkit.git
cd playwright-ai-toolkit
npm install
npx playwright install chromium
cp .env.example .env

# Install Ollama (https://ollama.com), then:
ollama pull llama3.1
ollama serve
```

`OLLAMA_HOST` and `OLLAMA_MODEL` in `.env` are optional; they default to `http://localhost:11434` and `llama3.1`.

## 1. Automated failure triage (`src/triage`)

Reads Playwright's JSON report and classifies each failure as `flaky`, `real_bug`, `broken_selector`, or `environment_issue`, with reasoning and a suggested action. Produces `triage-report.md`.

```bash
# Generate a real report from your suite:
npx playwright test --reporter=json > test-results/results.json
npm run triage -- test-results/results.json

# Or try it with the included example:
npm run triage -- examples/sample-results.json
```

Designed to run as the last step of a CI pipeline (see `.github/workflows/ci.yml`): instead of someone opening 40 failed tests one by one, the report arrives already prioritized, with real bugs first.

## 2. Self-healing selectors (`src/healing`)

`healingLocator(page, selector, description)` tries the normal selector first. If it fails, it sends the model the page's current HTML plus a natural-language description of the element, and uses the suggested selector **only for that run** — it never rewrites your code automatically.

Every healing attempt (successful or not) is recorded in `healing-log.json`, so the team can review it and decide whether to update the real selector in the source code.

```ts
import { healingLocator } from "./src/healing/healingLocator.js";

const button = await healingLocator(
  page,
  "#submit-btn", // the selector that broke
  "the button that submits the login form" // description for the AI
);
await button.click();
```

Demo test (against a public practice page):

```bash
npm test -- example.spec.ts
```

**Why no silent auto-fix:** a selector that "no longer finds anything" is sometimes the correct signal of a real bug (e.g. a button that disappeared by mistake). Auto-repairing without leaving a trace would hide exactly the kind of regression the test was supposed to catch.

## 3. Test generation from user stories (`src/generation`)

Takes a user story in markdown and generates a draft `.spec.ts` following Page Object Model, with happy path + edge cases, and explicit TODOs where selectors are placeholders (the generator doesn't know your app's real DOM).

```bash
npm run generate-test -- examples/sample-user-story.md
# -> generates tests/generated/sample-user-story.spec.ts
```

It solves the "blank page problem": starting from a complete structure instead of an empty file. The output must ALWAYS be reviewed before running or committing it.

## Repo structure

```
src/
  anthropicClient.ts      # shared LLM client (Ollama)
  triage/                 # module 1
  healing/                # module 2
  generation/             # module 3
examples/                 # sample inputs to try each module
tests/                    # real Playwright tests, including the healing demo
.github/workflows/ci.yml  # example pipeline with automated triage
```

## Honest limitations (read before using in production)

- Triage and healing depend on the quality of the HTML/errors they receive — in very dynamic apps (SPAs with lots of in-memory state) accuracy drops.
- Test generation produces placeholder selectors, not real ones — it always needs human review.
- Output quality depends on the local model you choose; small models may return malformed JSON or weaker suggestions. On a large suite, batching (which the triage module already does) keeps calls manageable.
- This is a starting point, not a maintained library with semantic versioning or exhaustive tests of its own.

## License

MIT — use it, modify it, adapt it to your stack.
