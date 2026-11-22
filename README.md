# Wandering

**A plot-tree tool for creative writers.** Grow your story as a branching tree of plot points, write it beat by beat, and come away with a finished draft.

### ▶ Try it: [wandering.cactislove.workers.dev](https://wandering.cactislove.workers.dev)

No account needed. Your projects stay in your own browser.

## What it does

- **Start rough.** Type or dictate a messy idea. Wandering tidies the wording into a short plot reminder that stays at the top while you work.
- **Choose your structure, or don't.** Ask for a suggested outline (structural stages like *inciting incident* and *midpoint reversal*, at the pacing you pick), or start from scratch and let the story find its own length.
- **Branch freely.** At every plot point, write your own next step or ask for a few distinct suggestions. Keep several possibilities as branches and explore each one.
- **See the whole story.** A story map sits beside you the whole time, from the first beat down to every ending, with an optional subplot in its own lane.
- **Write on a real page.** A Google Docs-sized page with a heading for each plot point. Click anywhere in the map to jump there.
- **Read it back and take it with you.** Review the finished text as one clean piece, then download it as Word, PDF, Markdown, plain text or HTML, or paste it straight into Google Docs.

**The AI proposes structure only.** It suggests outlines and plot points and tidies your idea's wording, and it never writes your prose. Suggestions appear only when you ask for them.

## The four steps

1. **Idea.** Describe the story, however roughly, and choose how to begin. **Start from scratch** takes you straight to the tree, with no outline and no set length. **Suggest** lets you set a pacing, from slow burn (12 beats) to fast (5 beats), and get a structural outline. Each beat names the job that part of the story does, not what happens. Rewrite any beat in place, or drag beats into a new order.
2. **Tree.** One plot point is in view at a time, with "What happens next" below it. **Write your own**, or click **Suggest beats** for options. **Go here** moves on to an option; **Keep for later** saves it as another branch. Mark any last plot point as an ending, edit a plot point in place, or add a subplot and mark where it meets the main plot. The story map beside you shows the whole tree.
3. **Write.** A rich-text page tells one branch of the story, with a heading for each plot point. Each plot point has one text, so a scene shared by two branches reads the same on both. Click a plot point in the map to jump to it or switch branch. Nothing you write on another branch is lost.
4. **Review.** The finished text of the branch you choose, laid out as one piece with no headings. Pick which beats it tells in the story map, weave in the subplot if you have one, and export it.

## Your work

Projects are kept in your browser's local storage, and nothing is uploaded. **Projects** in the top bar lists every story in this browser and lets you start, open, rename or delete one. You can also download a whole project as a `.wandering.json` file and open it again later, or on another computer. Clearing your browser's data removes projects you haven't downloaded.

Accounts, credits and "connect your own AI account" are previews of what's planned; their controls don't work yet.

---

## For developers

Built with Next.js (App Router) and TypeScript, TipTap for the editor, and zod for validating AI replies. It's hosted on Cloudflare Workers.

### Run it locally

```
npm install
npm run dev
```

Open http://localhost:3000.

```
npm test
```

runs the unit tests: tree logic (including where a plot point's heading goes in the document), storing writing per plot point, and turning the writing into plain text, Markdown and HTML for export.

### AI provider

Settings live in `.env.local` (see `.env.example`). The key stays on the server.

| Variable | Meaning |
|---|---|
| `AI_PROVIDER` | `openrouter`, `openai-compatible` or `mock` |
| `AI_API_KEY` | Your provider key |
| `AI_MODEL` | Model id, exactly as the provider names it, e.g. `openai/gpt-6-luna` on OpenRouter |
| `AI_BASE_URL` | Optional. Overrides the provider's default endpoint |
| `AI_REASONING_EFFORT` | Optional. `low` makes suggestions much faster on models that think before answering |

`openrouter` uses OpenRouter's endpoint. `openai-compatible` talks to any other Chat Completions-style endpoint and defaults to `https://api.openai.com/v1`. `mock` returns canned text so the interface can be tried without a key.

AI errors reach the writer as plain messages. The technical cause (which setting to check, the provider's reply) is logged on the server with an `[ai]` prefix.

### Deploy to Cloudflare

Wandering runs on Cloudflare Workers through the OpenNext adapter (`@opennextjs/cloudflare`). Its API routes need a server, so a static export won't work. `wrangler.jsonc` holds the Worker's settings (name `wandering`, which must match the Worker's name in the Cloudflare dashboard) and the AI settings that aren't secret. `open-next.config.ts` holds the adapter's settings.

**The AI key is a Cloudflare secret, never a file in the repo:**

```
npx wrangler secret put AI_API_KEY
```

(or in the dashboard: Workers & Pages → wandering → Settings → Variables and Secrets → add `AI_API_KEY` as a **Secret**). Running the command again replaces it straight away, with no rebuild. `npx wrangler secret delete AI_API_KEY` removes it.

**Deploying from this machine:** `npm run deploy` builds the Worker and uploads it. OpenNext copies the values in every local .env file into the Worker's code, one set per mode. Keep the key in `.env.development.local`, which `npm run dev` reads. Before uploading, `scripts/check-worker-secrets.mjs` empties the development and test sets (the Worker only uses the production one). It stops the deploy if the key is still in the bundle, for example because it's in `.env.local`.

**Deploying from GitHub (Workers Builds):** set the build command to `npx opennextjs-cloudflare build` and the deploy command to `npx opennextjs-cloudflare deploy`. The repo has no .env files with keys, so the key comes only from the secret.

`npm run preview` runs the built Worker locally in Cloudflare's runtime at http://localhost:8787, reading its key from `.dev.vars` (see `.dev.vars.example`).

### Where things are

- `app/page.tsx`: the stepper and step 1
- `components/TreeStep.tsx`, `PlotPanel.tsx`, `PlotPointView.tsx`, `PlotPointEditor.tsx`, `TreeGraph.tsx`, `BPlotPanel.tsx`: step 2
- `components/WriteStep.tsx`, `PlotAnchor.tsx`: step 3, the editor and its anchor node (shown as a plot point heading)
- `components/ReviewStep.tsx`: step 4. `lib/manuscript.ts` turns the chosen plot points' writing into one text (plain text, Markdown, HTML), and `lib/exporters.ts` makes the Word and PDF files (with the `docx` and `pdfmake` packages)
- `components/ProjectMenu.tsx`: the Projects dialog (new, open, rename, delete, download or re-open a copy)
- `lib/doc.ts`: splitting the editor document into per-plot-point sections and composing one branch's document from them
- `lib/tree.ts`: node traversal, graph layout, anchor ordering, and the limits (options per parent, choices per parent, nodes per level, depth range) as constants
- `lib/project.ts`: the open project's state
- `lib/storage.ts`: the project library, kept in this browser's local storage (one entry per project plus an index)
- `app/api/*`: route handlers for the guide rail (the outline), options, B-plot premise, plot (the tidied idea), and status
- `lib/ai/prompts.ts`: all prompt wording
- `lib/ai/provider.ts`: the provider interface; add a provider by implementing it

### Notes

- **Names.** The interface calls the guide rail the **outline**, a tree level a **beat**, and the B plot the **subplot**. The code keeps the older names.
- **Writing.** The writing is stored per plot point, under the plot point's anchor (its heading in the editor). Headings can't be deleted while their plot point is in the tree. Writing under a plot point you delete is hidden but stays in the project and in downloaded copies. Saves from when every branch kept its own copy are folded together on load, keeping every distinct text.
- **Plot reminder.** The tidied idea is redone only when the idea changes. Until then, or if the request fails, the idea shows as typed.
- **Exports.** Word and PDF files are US Letter with one-inch margins, set in Times. The PDF library loads only when a PDF is made.
- **Concept screens.** Accounts (`components/AccountConcept.tsx`) and credits (`components/CreditsConcept.tsx`) are non-working previews. Credits are hidden from the top bar until they work.
