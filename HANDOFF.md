# Wandering — Build Handoff (v2, reworked)

Repo: https://github.com/dabcow/wandering (currently empty; this file is the starting point).

## One-line pitch
A plot-tree tool for creative writers. Enter a story idea, set a pacing level, then branch through plot-point choices level by level until you have a tree-shaped skeleton of your story (plus an optional B-plot tree). Then write in a document alongside the tree, jumping to any node to write at that point in the story.

## Decisions (confirmed with the user)
| Area | Decision |
|---|---|
| Stack | Next.js (App Router) + TypeScript. API routes for LLM calls. |
| AI | Single working provider via server-side env key (see "AI layer"). Credits and "link your own AI account" are **concept-only UI**. |
| Voice input | Browser Web Speech API on the idea box; feature-detect and fall back to text. |
| Pacing | Slider that sets the **depth of the tree** (target number of levels / how much happens per node). |
| Step 1 outline | A rough ordered beat list generated from the idea acts as a **guide rail** anchoring each level. |
| Branching | Each selected node gets **its own set of child options**; user can pick multiple per parent. |
| Endings | Pacing sets a target depth; as depth nears it, options include ending choices. User can also mark any node as an ending, or keep going. |
| B plot | **Parallel tree** built with the same mechanics, with optional **link points** where B-plot nodes intersect/merge with main-plot nodes. |
| Tree UI | Node-link graph with **level columns**; nodes as cards with connecting lines; B plot as a second lane below the main tree. |
| Writing doc | **Rich-text editor with node anchors**; tree in a side tab. |
| Persistence | No accounts; projects saved in browser (localStorage/IndexedDB). |
| Export | Copy document to clipboard as rich text (HTML + plain) for pasting into Google Docs. No OAuth. |
| Look and feel | Dark, techy, notebook-like (IDE vibe, monospace accents; prose in the editor stays readable). |

## User flow

### Step 1 — Idea and pacing
- Large text box plus mic button (dictation). Text remains editable.
- Pacing slider (e.g. Slow burn ↔ Fast). Maps to a target depth (suggest roughly 5 to 12 levels) and to how big each beat is. Show the resulting level count to the user.
- On submit, the AI returns a **guide-rail outline**: an ordered list of beats (introduction → … → ending), one per level, each with a short description. This anchors the levels used in Step 2. Display it so the user knows the intended arc.

### Step 2 — Branching plot tree
- **Level 1** (usually the introduction): show 3–4 AI-generated options for the first plot point, plus an always-present **"Write your own"** card with a text input.
- User may **select multiple** nodes at the current level to explore.
- Advance to the next level: for **each selected node**, generate 3–4 child options (conditioned on the path from the root to that node, the idea, and the guide-rail beat for that level) plus a "Write your own" slot. User selects multiple children per parent. Cap selections per parent and total nodes per level (suggest 3 per parent, ~6–8 per level) to keep the tree manageable; make the caps constants.
- Repeat until endings. Near target depth, options include **ending choices**. The user can also mark any node as an ending, or continue past the target depth. A branch is complete when it ends in an ending node.
- Result: a tree skeleton. Nodes store: id, parentId, level, title, summary, source (`ai` | `user`), isEnding, plot (`main` | `b`), and optional `links` to nodes in the other plot.
- Let the user prune (delete a node and its subtree) and edit node text at any time.
- **B plot:** a button "Add B plot" starts a second tree in a parallel lane. Same mechanics, its own idea/seed (user can type a B-plot premise or let the AI propose one based on the main idea). B-plot options should be generated with awareness of the main tree. Users can add **link points** by connecting a B-plot node to a main-plot node (shown as a dashed line), meaning they intersect or merge at that moment.

### Step 3 — Writing document
- Layout: rich-text editor (suggest TipTap) as the main pane; **tree in a side tab/panel** (collapsible) showing how the plot develops, using the same node-link visualization at a smaller scale.
- The document contains **anchor markers** (non-text, e.g. custom TipTap node or mark) corresponding to tree nodes, in story order. Clicking a **leaf node** in the tree moves the cursor to that node's anchor and scrolls it into view. If the node has no anchor yet, create one at the correct position: **a level 2 node places the cursor between the anchors of level 1 and level 3** along that path (insert after the nearest preceding anchor, before the nearest following one). Generalize this rule for any node.
- Clicking non-leaf nodes should also work (same positioning rule); the user specifically asked for leaf nodes, so make those the primary affordance.
- Tree shows per-node status: has anchor, has text written. Optionally show the node's summary in a small header above its anchor in the editor, collapsible.
- With multiple branches, the document follows one chosen path at a time. Provide a path selector (or highlight the path of the clicked leaf) and make clear that the doc is one linear telling of the chosen branch. Decide how to handle text for nodes not on the active path (suggested: keep it in the doc but visually mark inactive-branch anchors; do not delete user text).
- Export: "Copy for Google Docs" writes `text/html` and `text/plain` via `ClipboardItem`; anchors are stripped (or optionally exported as headings); toast confirms.

## AI layer
- Provider-agnostic interface, each call returning validated JSON (zod):
  - `generateGuideRail(idea, pacing)` → ordered beats
  - `generateOptions({ idea, pacing, guideRail, pathToParent, level, plot, otherPlotContext, count })` → options (include `isEnding` suggestions near target depth)
  - `generateBPlotPremise(idea, mainTreeSummary)` → suggested premise
- Implement **one real provider** via env vars (`AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, optional `AI_BASE_URL`). The user mentioned "GPT Luna"; the exact provider/API is unconfirmed. Ask the user, or default to an OpenAI-compatible chat completions adapter with configurable base URL and model.
- Keys stay server-side; all calls go through Next.js route handlers.
- Keep prompt building in one module. Options should be meaningfully distinct from each other (vary genre-of-twist: escalation, reversal, reveal, complication) and consistent with the path so far.
- Handle loading/error/retry per node; generation for multiple selected parents can run in parallel.
- **Concept-only UI (non-functional):** a "Credits" badge and a "Connect your own AI account" option in a settings modal; clicking shows "coming soon". No payments or auth.

## Suggested structure
- `app/` — stepper: Idea → Tree → Write
- `app/api/guide-rail/route.ts`, `app/api/options/route.ts`, `app/api/b-plot/route.ts`
- `lib/ai/` — provider interface, adapter, prompts, zod schemas
- `lib/tree.ts` — node types, path utilities, anchor-ordering logic (pure, unit tested)
- `lib/storage.ts` — save/load project (idea, pacing, guide rail, nodes, links, document JSON)
- `components/` — `IdeaInput` (mic), `PacingSlider`, `LevelPicker` (options + write-your-own), `TreeGraph` (level columns, B-plot lane, link lines), `WriterEditor`, `TreeSidePanel`, `ExportButton`, `CreditsConcept`
- Tree graph can be SVG/CSS grid with absolutely positioned cards; consider `reactflow` if layout gets heavy, but level-column layout is simple enough to hand-roll.

## Acceptance criteria for v1
- Type or dictate an idea, set pacing, get a guide-rail outline from the real provider.
- Step through levels: choose multiple options, each selected node spawns its own options, "Write your own" always available, endings appear near target depth.
- Tree is visible as a level-column node-link graph; nodes can be edited and pruned.
- B-plot tree can be added in a parallel lane and linked to main-plot nodes.
- Writing doc opens with tree side tab; clicking a leaf positions the cursor at the correct anchor (unit-test the "level 2 goes between 1 and 3" ordering).
- State survives reload.
- Copy-for-Google-Docs pastes cleanly (verify manually).
- Credits / link-account UI present but clearly non-functional.
- Dark theme, keyboard-accessible controls, usable at tablet width.

## Out of scope for v1
Accounts, cloud sync, real billing, Google OAuth / Docs API, collaboration, multiple linear manuscripts per tree.

## Open questions to resolve first
- Exact provider/model behind "GPT Luna" and its API shape.
- Confirm default branch caps and pacing→depth mapping after the first prototype.
