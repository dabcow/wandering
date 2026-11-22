# Wandering

A plot-tree tool for creative writers. Enter a story idea and a pacing, get an outline of the arc, then branch through plot points beat by beat until you have a tree-shaped skeleton of the story, with an optional subplot in its own lane. Then write in a document beside the tree, under a heading for each plot point.

The AI proposes structure only: the outline, plot-point options, and a subplot premise. It never writes prose.

In the interface the guide rail is called the **outline**, a tree level a **beat**, and the B plot the **subplot**; the code keeps the older names.

## Run it

```
npm install
npm run dev
```

Open http://localhost:3000.

```
npm test
```

runs the unit tests for the tree logic (including where a plot point's anchor goes in the document) and for storing the writing per plot point.

## The four steps

1. **Idea**: type or dictate the idea, then choose how to start. **Start from scratch** goes straight to the Tree step with no outline: the story has no expected number of beats, and the story map grows one beat at a time, with an open "What comes next" beat at the bottom. **Suggest** shows the pacing and asks the AI for an outline. Pacing sets how many beats the story has, from 12 (slow burn) to 5 (fast). The outline is structural (stages such as setup, inciting incident and midpoint reversal, each with the job it does), not a list of events: the events are chosen beat by beat in the Tree step. One beat per row of the story map. The outline is a suggestion: each beat's title and description can be rewritten in place, and beats can be dragged by their handle (or moved with the keyboard) into a different order.
2. **Tree**: a **Plot** panel at the top reminds you of the central idea, with typos and dictation filler tidied by the AI (redone only when the idea changes; until then, or if it fails, the idea shows as typed). Below it, one plot point is in view at a time, as a card with its possible next steps below it: "Go here" moves straight on to one, "Keep for later" keeps it as another branch (up to three per plot point), or write your own. AI suggestions load only when you click "Suggest beats". The story map beside it shows the whole tree; click any plot point in it to go there. Endings are offered near the planned depth, and any last plot point can be marked as an ending. "Edit" turns the card into a form to change it, delete it with what follows, or connect it to the other plot.
3. **Write**: a rich-text document with the tree beside it. The document tells one branch of one plot and nothing else, with a heading for each of its plot points (the anchors in the code). Headings can't be deleted while their plot point is in the tree. Each plot point has one text, whichever branch it is read on: a parent reads the same whichever of its children follows it. (Saves from when every branch kept its own copy are folded together on load, keeping every distinct text.) The subplot has its own document, shown when you click one of its plot points. Clicking a plot point in the tree jumps to its heading, switching branch if needed; what you wrote elsewhere is kept. Writing under a plot point you later delete is no longer shown, but stays in the project (and in a downloaded copy). "Copy for Google Docs" copies the branch on screen.
4. **Review**: the finished text laid out as one piece, with no plot point headings, on a Google Docs-sized page. The story map beside it picks out the plot points whose writing is shown: click any plot point to tell its branch (the choice is shared with the Write step), and the subplot's chosen branch is woven in beat by beat unless "Weave in the subplot" is unticked. Download it as Word (.docx), PDF, Markdown, plain text or a web page (.html), or copy it for Google Docs. Word and PDF files are US Letter with one-inch margins, set in Times; the PDF library loads only when a PDF is made.

The story is kept in the browser. **File** in the top bar downloads the whole project as a `.wandering.json` file, opens one, or starts a new story.

## AI provider

Settings live in `.env.local` (see `.env.example`). The key stays on the server.

| Variable | Meaning |
|---|---|
| `AI_PROVIDER` | `openrouter`, `openai-compatible` or `mock` |
| `AI_API_KEY` | Your provider key |
| `AI_MODEL` | Model id, exactly as the provider names it, e.g. `openai/gpt-6-luna` on OpenRouter |
| `AI_BASE_URL` | Optional. Overrides the provider's default endpoint |
| `AI_REASONING_EFFORT` | Optional. `low` makes suggestions much faster on models that think before answering |

`openrouter` uses OpenRouter's endpoint. `openai-compatible` talks to any other Chat Completions-style endpoint and defaults to `https://api.openai.com/v1`. `mock` returns canned text so the interface can be tried without a key.

## Deploy to Cloudflare

Wandering runs on Cloudflare Workers through the OpenNext adapter (`@opennextjs/cloudflare`). Its API routes need a server, so a static export won't work. `wrangler.jsonc` holds the Worker's settings (name `wandering`, which must match the Worker's name in the Cloudflare dashboard) and the AI settings that aren't secret. `open-next.config.ts` holds the adapter's settings.

**The AI key is a Cloudflare secret, never a file in the repo:**

```
npx wrangler secret put AI_API_KEY
```

(or in the dashboard: Workers & Pages → wandering → Settings → Variables and Secrets → add `AI_API_KEY` as a **Secret**). Running the command again replaces it straight away, with no rebuild; `npx wrangler secret delete AI_API_KEY` removes it.

**Deploying from this machine:** `npm run deploy` builds the Worker and uploads it. OpenNext copies the values in every local .env file into the Worker's code, one set per mode. Keep the key in `.env.development.local`, which `npm run dev` reads. Before uploading, `scripts/check-worker-secrets.mjs` empties the development and test sets (the Worker only uses the production one) and stops the deploy if the key is still in the bundle, for example because it is in `.env.local`.

**Deploying from GitHub (Workers Builds):** set the build command to `npx opennextjs-cloudflare build` and the deploy command to `npx opennextjs-cloudflare deploy`. The repo has no .env files with keys, so the key comes only from the secret.

`npm run preview` runs the built Worker locally in Cloudflare's runtime at http://localhost:8787, reading its key from `.dev.vars` (see `.dev.vars.example`).

## Where things are

- `app/page.tsx`: the stepper and step 1
- `components/TreeStep.tsx`, `PlotPointView.tsx`, `PlotPointEditor.tsx`, `TreeGraph.tsx`, `BPlotPanel.tsx`: step 2
- `components/ProjectMenu.tsx`: download, open and new story
- `components/WriteStep.tsx`, `PlotAnchor.tsx`: step 3, the editor and its anchor node (shown as a plot point heading)
- `components/ReviewStep.tsx`: step 4; `lib/manuscript.ts` turns the chosen plot points' writing into one text (plain text, Markdown, HTML), and `lib/exporters.ts` makes the Word and PDF files (with the `docx` and `pdfmake` packages)
- `lib/doc.ts`: splitting the editor document into per-plot-point sections and composing one branch's document from them
- `app/api/*`: route handlers for guide rail (the outline), options, B-plot premise, plot (the tidied idea), status
- `lib/tree.ts`: node traversal, graph layout, anchor ordering, and the limits (options per parent, choices per parent, nodes per level, depth range) as constants
- `lib/ai/prompts.ts`: all prompt wording
- `lib/ai/provider.ts`: the provider interface; add a provider by implementing it
- `lib/project.ts`: the open project's state
- `lib/storage.ts`: the project library, kept in this browser's local storage (one entry per project plus an index)
- `components/ProjectMenu.tsx`: the Projects dialog (new, open, rename, delete, download or re-open a copy)

Projects are real but local: nothing is uploaded, and clearing the browser's data removes them. Accounts are a preview only (`components/AccountConcept.tsx`): the Sign in dialog shows what is planned and its controls are disabled. Credits and "connect your own AI account" are also concept screens (`components/CreditsConcept.tsx`), hidden from the top bar until they work.

AI errors reach the writer as plain messages; the technical cause (which setting to check, the provider's reply) is logged on the server with an `[ai]` prefix.
