# Wandering

Speak or type a rough idea, set the style on a pentagon, get an outline, then work the draft as notebook-style paragraph cells. Each cell has a "rabbit hole" of alternative rewrites. When you're done, copy the piece into Google Docs.

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
| `AI_PROVIDER` | `openai-compatible` (default) or `mock` |
| `AI_API_KEY` | Your provider key |
| `AI_MODEL` | Model id, exactly as the provider names it |
| `AI_BASE_URL` | Optional. Defaults to `https://api.openai.com/v1` |

`openai-compatible` talks to any Chat Completions-style endpoint. `mock` returns canned text so the interface can be tried without a key.

## Where things are

- `app/page.tsx`: the four-step flow (idea, style, outline, cells)
- `app/api/*`: route handlers for outline, draft, alternatives, status
- `lib/ai/prompts.ts`: all prompt wording, including how pentagon values become style directives
- `lib/ai/provider.ts`: the provider interface; add a provider by implementing it
- `lib/attributes.ts`: the style axes (the pentagon draws one corner per entry)
- `lib/project.ts`, `lib/storage.ts`: project state and browser persistence

Credits and "connect your own AI account" are concept screens only.
