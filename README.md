# Wandering

A writing tool that plans with you and leaves the writing to you. Speak or type a rough idea, set the style on a pentagon and choose a length, and get an outline. Each outline section is a cell: click it to write that paragraph yourself, with the outline note beside you. Cells can be reordered, each is tinted by its mood, and each has a "rabbit hole" where you write other versions of the paragraph and swap them in. When you are done, copy the piece into Google Docs.

The AI only writes the outline (title, section notes and moods). It never drafts or rewrites your paragraphs.

## Run it

```
npm install
npm run dev
```

Open http://localhost:3000.

## AI provider

Settings live in `.env.local` (see `.env.example`). The key stays on the server.

| Variable | Meaning |
|---|---|
| `AI_PROVIDER` | `openrouter`, `openai-compatible` or `mock` |
| `AI_API_KEY` | Your provider key |
| `AI_MODEL` | Model id, exactly as the provider names it, e.g. `openai/gpt-6-luna` on OpenRouter |
| `AI_BASE_URL` | Optional. Overrides the provider's default endpoint |

`openrouter` uses OpenRouter's endpoint. `openai-compatible` talks to any other Chat Completions-style endpoint and defaults to `https://api.openai.com/v1`. `mock` returns canned text so the interface can be tried without a key.

## Where things are

- `app/page.tsx`: the three-step flow (idea, style, outline)
- `components/CellList.tsx`, `components/Cell.tsx`: the writing board, cells and rabbit holes
- `app/api/*`: route handlers for outline and status
- `lib/ai/prompts.ts`: all prompt wording, including how pentagon values become style directives
- `lib/ai/provider.ts`: the provider interface; add a provider by implementing it
- `lib/attributes.ts`: the style axes (the pentagon draws one corner per entry)
- `lib/length.ts`: how the Length setting turns the idea's size into a section count
- `lib/moods.ts`: the moods and their colours
- `lib/project.ts`, `lib/storage.ts`: project state and browser persistence

Credits and "connect your own AI account" are concept screens only. `HANDOFF.md` is the original brief and predates the move to writer-written cells.
