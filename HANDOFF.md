# Wandering — Build Handoff

Repo: https://github.com/dabcow/wandering (currently empty; this file is the starting point).

## One-line pitch
A writing tool where you speak or type a rough idea, set your desired style on an attribute pentagon, get an outline, edit the text as Jupyter-style paragraph cells, explore alternative rewrites per paragraph ("rabbit holes"), then copy the finished text into Google Docs.

## Decisions (confirmed with the user)
| Area | Decision |
|---|---|
| Stack | Next.js (App Router) + TypeScript. API routes for LLM calls. |
| AI | Single working provider via server-side env key (see "AI layer"). Billing/credits and "link your own AI account" are **concept-only UI**, not functional. |
| Voice input | Browser Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`). Feature-detect and fall back to text only. |
| Export | Copy to clipboard as rich text (HTML + plain text) so it pastes cleanly into Google Docs. No Google OAuth. |
| Style input | Pentagon with fixed default attributes and draggable vertices. |
| Rabbit hole | Several alternative rewrites of a paragraph; pick one to swap in. |
| Persistence | No accounts. Projects saved in browser (localStorage or IndexedDB). |
| Writing scope | General-purpose; outline adapts to the idea (no templates). |
| Cells | Jupyter-style vertical stack of editable text cells with drag handles and a per-cell toolbar. |
| Look and feel | Dark, techy, notebook-like (IDE vibe, monospace accents). Prose in cells should stay readable. |

## User flow
1. **Idea** — Large text box plus mic button. User types or dictates their rough idea. Live transcript appears in the box and stays editable.
2. **Style** — Pentagon with 5 axes, default: **Professional, Concise, Warm, Persuasive, Vivid**. Each vertex is draggable (0–100). Keep the shape logic generic (N-gon) so axes can later be added, removed or renamed, but v1 ships with the fixed five. Show numeric values and a reset button.
3. **Outline** — Call the AI with idea + attribute values. Return a structured outline (title plus ordered sections, each with a short intent). User may edit or regenerate before continuing.
4. **Cells** — Each outline section becomes a draft paragraph in its own cell. Cells can be edited inline, reordered by drag and drop (use `dnd-kit`), added, deleted and duplicated. Each cell has a "rabbit hole" button.
5. **Rabbit hole** — Opens a panel/drawer for that cell showing 3–5 alternative rewrites generated with the same attribute values plus the surrounding context. User picks one to replace the cell text (original kept in an undo/history list). Include "more alternatives" to regenerate.
6. **Export** — "Copy for Google Docs" button writes `text/html` and `text/plain` to the clipboard via `ClipboardItem`, with a toast confirming. Title becomes an H1; cells become paragraphs in order.

## AI layer
- Define a provider-agnostic interface, e.g. `generateOutline(idea, attributes)` and `generateAlternatives(paragraph, context, attributes, n)`, both returning validated JSON (use zod).
- Implement **one real provider** selected by env vars (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`). The user mentioned "GPT Luna"; I could not confirm what that model/API is, so ask the user for the exact provider and endpoint, or default to an OpenAI-compatible chat completions adapter and make base URL and model configurable.
- Never expose the key to the client; all calls go through Next.js route handlers.
- Prompts should turn pentagon values into plain-language style directives (e.g. Concise 80 → "very concise, cut filler"). Keep the prompt-building in one module so it is easy to tune.
- Handle loading, error and retry states in the UI.
- **Concept-only UI (non-functional):** a "Credits" badge/button and a "Connect your own AI account" option in a settings/modal. Clicking shows a "coming soon" state. Do not build payments or auth.

## Suggested structure
- `app/` — pages: single-page stepper (Idea → Style → Outline → Cells)
- `app/api/outline/route.ts`, `app/api/alternatives/route.ts`
- `lib/ai/` — provider interface, adapter, prompt builders, zod schemas
- `lib/storage.ts` — save/load project (idea, attributes, outline, cells, history)
- `components/` — `Pentagon`, `IdeaInput` (with mic), `OutlineEditor`, `CellList`, `Cell`, `RabbitHolePanel`, `ExportButton`, `CreditsConcept`
- Render the pentagon as SVG with pointer-event dragging; make it touch friendly.

## Acceptance criteria for v1
- Dictate or type an idea; mic gracefully hidden/disabled when unsupported.
- Adjust pentagon, generate a real outline from the configured provider.
- Cells render, edit, reorder, add and delete; state survives page reload.
- Rabbit hole returns real alternatives and swaps one in; original recoverable.
- Copy button pastes correctly formatted text into a Google Doc (manually verify).
- Credits / link-account UI present but clearly non-functional.
- Dark theme, responsive down to tablet width, keyboard accessible controls.

## Out of scope for v1
Accounts, cloud sync, real billing, Google OAuth / Docs API, templates per writing type, user-customizable attributes (design for it, don't build it), collaboration.

## Open questions to resolve first
- Exact provider/model behind "GPT Luna" and its API shape.
- Whether the user wants a project name/branding beyond "Wandering".
