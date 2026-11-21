"use client";

import { DOMSerializer, Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { Selection } from "@tiptap/pm/state";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  ArrowLeft,
  ArrowRight,
  Bold,
  ClipboardCopy,
  Heading2,
  Heading3,
  Italic,
  List,
  PanelRightClose,
  PanelRightOpen,
  Quote,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { ANCHOR_TYPE, composeDoc, sectionStatus, splitDoc } from "@/lib/doc";
import { copyRichText, escapeHtml } from "@/lib/export";
import type { Action } from "@/lib/project";
import { saveProject } from "@/lib/storage";
import { anchorInsertIndex, firstLeafUnder, leavesOf, pathTo } from "@/lib/tree";
import type { Plot, PlotNode, Project } from "@/lib/types";
import { AnchorContext, PlotAnchor } from "./PlotAnchor";
import { TreeGraph } from "./TreeGraph";

type Props = {
  project: Project;
  dispatch: Dispatch<Action>;
  onToast: (message: string, kind?: "ok" | "error") => void;
  onBack: () => void;
  /** Go on to step 4, the finished text. */
  onReview: () => void;
};

type AnchorAt = { nodeId: string; pos: number; size: number };

/** Top-level anchors in document order. */
function findAnchors(doc: PMNode): AnchorAt[] {
  const anchors: AnchorAt[] = [];
  doc.forEach((child, offset) => {
    if (child.type.name === ANCHOR_TYPE) {
      anchors.push({ nodeId: String(child.attrs.nodeId ?? ""), pos: offset, size: child.nodeSize });
    }
  });
  return anchors;
}

/**
 * Put the cursor at a node's anchor, creating the anchor in its proper place
 * in the story order first if the document does not have one yet.
 */
function goToAnchor(editor: Editor, nodeId: string, order: string[], focus = true) {
  const { state, view, schema } = editor;
  const anchors = findAnchors(state.doc);
  const existing = anchors.find((a) => a.nodeId === nodeId);
  const paragraph = schema.nodes.paragraph;
  let tr = state.tr;
  let after: number;

  if (existing) {
    after = existing.pos + existing.size;
    const next = state.doc.resolve(after).nodeAfter;
    // An anchor with nothing writable after it gets an empty paragraph to type in.
    if (!next || next.type.name === ANCHOR_TYPE) tr = tr.insert(after, paragraph.create());
  } else {
    const anchor = schema.nodes[ANCHOR_TYPE].create({ nodeId });
    const untouched = state.doc.childCount === 1 && state.doc.firstChild?.content.size === 0;
    if (untouched) {
      tr = tr.replaceWith(0, state.doc.content.size, [anchor, paragraph.create()]);
      after = anchor.nodeSize;
    } else {
      const index = anchorInsertIndex(
        anchors.map((a) => a.nodeId),
        order,
        nodeId,
      );
      const pos = index < anchors.length ? anchors[index].pos : state.doc.content.size;
      tr = tr.insert(pos, [anchor, paragraph.create()]);
      after = pos + anchor.nodeSize;
    }
  }

  tr = tr.setSelection(Selection.near(tr.doc.resolve(after), 1));
  if (focus) tr = tr.scrollIntoView();
  view.dispatch(tr);
  if (focus) view.focus();
}

/** Step 3: write the story beside the tree. */
export function WriteStep({ project, dispatch, onToast, onBack, onReview }: Props) {
  const { nodes, guideRail, links, bPlot, activeLeaf, intro, sections, title } = project;
  const [panelOpen, setPanelOpen] = useState(true);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const leaves = useMemo(
    () => ({ main: leavesOf(nodes, "main"), b: leavesOf(nodes, "b") }),
    [nodes],
  );
  // The saved choice if it still exists and is still a leaf; otherwise the first leaf.
  const leafId = (plot: Plot): string | null => {
    const saved = activeLeaf[plot];
    if (saved && leaves[plot].some((n) => n.id === saved)) return saved;
    return leaves[plot][0]?.id ?? null;
  };
  // The document tells one branch of one plot: the main plot, or the subplot once one of its
  // plot points is clicked. The other plot's writing is not in it.
  const [viewPlot, setViewPlot] = useState<Plot>("main");
  const plot: Plot = viewPlot === "b" && leaves.b.length > 0 ? "b" : "main";
  const leaf = leafId(plot);
  const pathKey = `${plot}:${leaf}`;

  // The plot points on the branch, from its start to its end.
  const path = useMemo(() => (leaf ? pathTo(nodes, leaf) : []), [nodes, leaf]);
  const order = useMemo(() => path.map((n) => n.id), [path]);
  const activeIds = useMemo(() => new Set(order), [order]);
  // Each plot point has one text, whichever branch it is read on: a parent reads the same
  // whichever of its children follows it.

  // Only the branch's own plot points are shown. Writing under a plot point deleted from the
  // tree is not shown; it stays in the project untouched, since this editor never owns it.

  /** What this editor instance shows: the plot points whose sections it owns. */
  const mine = useMemo(() => ({ projectId: project.id, owned: order }), [project.id, order]);

  // Read by the editor's anchors, which outlive a render.
  const liveIds = useRef(byId);
  useEffect(() => {
    liveIds.current = byId;
  });

  // A new editor for each path: its document is that path's sections and nothing else.
  // Every plot point on the path gets its heading up front, so there is a place to write under each.
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [2, 3] } }),
        PlotAnchor.configure({ keep: (nodeId) => liveIds.current.has(nodeId) }),
      ],
      content: composeDoc(
        intro,
        Object.fromEntries(order.map((id) => [id, sections[id] ?? []])),
        order,
      ),
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "writer prose",
          role: "textbox",
          "aria-label": "Story document",
          "aria-multiline": "true",
        },
      },
    },
    [pathKey],
  );

  const marks = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive("bold"),
            italic: current.isActive("italic"),
            h2: current.isActive("heading", { level: 2 }),
            h3: current.isActive("heading", { level: 3 }),
            list: current.isActive("bulletList"),
            quote: current.isActive("blockquote"),
          }
        : null,
  });

  // What the current editor instance shows, for saving it back to the right plot points.
  const shown = useRef({ editor, mine, pathKey });
  const saveTimer = useRef<number | undefined>(undefined);
  const latest = useRef(project);
  useEffect(() => {
    latest.current = project;
  });

  /** Write the editor's contents back to the plot points it shows. */
  const save = (from: Editor, view: typeof mine) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    dispatch({ type: "saveWriting", projectId: view.projectId, owned: view.owned, ...splitDoc(from.getJSON()) });
  };

  // Save shortly after each change, and at once when leaving.
  useEffect(() => {
    if (!editor) return;
    // What this instance was built from; it changes only together with the instance.
    const view = mine;
    shown.current = { editor, mine: view, pathKey };
    const onUpdate = () => {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => save(editor, view), 400);
    };
    // A reload gives React no time to render, so write straight to storage.
    const onLeave = () => {
      const current = latest.current;
      // Another project has been opened since; this editor's text was already saved to its own.
      if (current.id !== view.projectId) return;
      const kept = Object.fromEntries(
        Object.entries(current.sections).filter(([key]) => !view.owned.includes(key)),
      );
      const split = splitDoc(editor.getJSON());
      saveProject({ ...current, intro: split.intro, sections: { ...kept, ...split.sections } });
    };
    editor.on("update", onUpdate);
    window.addEventListener("pagehide", onLeave);
    return () => {
      editor.off("update", onUpdate);
      window.removeEventListener("pagehide", onLeave);
      if (saveTimer.current !== undefined) save(editor, view);
    };
    // `mine` is read once per editor instance on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, dispatch]);

  const page = useRef<HTMLDivElement>(null);
  // A plot point to jump to once the editor for a newly chosen path exists.
  const pendingJump = useRef<string | null>(null);
  useEffect(() => {
    if (!editor || !pendingJump.current) return;
    // Wait for the instance built for this path; the previous path's editor lingers for one render.
    if (shown.current.editor !== editor || shown.current.pathKey !== pathKey) return;
    const nodeId = pendingJump.current;
    if (!order.includes(nodeId)) return;
    // A freshly built editor is moved into the page a moment after it is created, and that
    // move drops keyboard focus. Wait until it is in place before putting the cursor in it.
    let tries = 0;
    let timer: number | undefined;
    const attempt = () => {
      if (editor.isDestroyed || pendingJump.current !== nodeId) return;
      try {
        if (page.current?.contains(editor.view.dom)) {
          pendingJump.current = null;
          goToAnchor(editor, nodeId, order);
          // The editor's DOM can be re-seated once more right after this; if that
          // knocked the cursor out and nothing else took focus, put it back.
          timer = window.setTimeout(() => {
            if (!editor.isDestroyed && !editor.isFocused && document.activeElement === document.body) {
              editor.view.focus();
            }
          }, 120);
          return;
        }
      } catch {
        // The view does not exist yet.
      }
      if (tries++ < 25) timer = window.setTimeout(attempt, 40);
    };
    // One tick's grace lets the new editor settle into the page first.
    timer = window.setTimeout(attempt, 40);
    return () => window.clearTimeout(timer);
  }, [editor, order, pathKey]);

  // Which plot points are written, for the dots in the tree.
  const status = useMemo(() => sectionStatus(sections), [sections]);
  const nothingWritten = intro.length === 0 && order.every((id) => !status.get(id)?.hasText);

  /** Tell a different branch: save what is on screen, then switch. The editor is rebuilt for it. */
  const showPath = (toPlot: Plot, toLeaf: string) => {
    if (shown.current.editor) save(shown.current.editor, shown.current.mine);
    setViewPlot(toPlot);
    dispatch({ type: "setActiveLeaf", plot: toPlot, id: toLeaf });
  };

  const goToNode = (node: PlotNode) => {
    if (!editor) return;
    if (activeIds.has(node.id)) {
      goToAnchor(editor, node.id, order);
      return;
    }
    // On another branch: display that branch, then go to the plot point.
    pendingJump.current = node.id;
    showPath(node.plot, firstLeafUnder(nodes, node.id)?.id ?? node.id);
  };

  const copy = async () => {
    if (!editor) return;
    // The document is already one linear telling; just leave the anchors out.
    const kept: PMNode[] = [];
    editor.state.doc.forEach((child) => {
      if (child.type.name !== ANCHOR_TYPE && (child.textContent.trim() || !child.isTextblock)) kept.push(child);
    });
    if (kept.length === 0) {
      onToast("Nothing is written on this branch yet.", "error");
      return;
    }
    const holder = document.createElement("div");
    holder.appendChild(DOMSerializer.fromSchema(editor.schema).serializeFragment(Fragment.from(kept)));
    const heading = title.trim();
    const html = (heading ? `<h1>${escapeHtml(heading)}</h1>` : "") + holder.innerHTML;
    const plain = [heading, ...kept.map((n) => n.textBetween(0, n.content.size, "\n\n", "\n"))]
      .filter((part) => part.trim())
      .join("\n\n");
    try {
      await copyRichText(html, plain);
      onToast("Copied this branch. Paste it into Google Docs.");
    } catch {
      onToast("Couldn't reach the clipboard. Check the browser's permission and try again.", "error");
    }
  };

  const tools = [
    { key: "bold", label: "Bold", icon: Bold, on: marks?.bold, run: () => editor?.chain().focus().toggleBold().run() },
    { key: "italic", label: "Italic", icon: Italic, on: marks?.italic, run: () => editor?.chain().focus().toggleItalic().run() },
    { key: "h2", label: "Heading", icon: Heading2, on: marks?.h2, run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: "h3", label: "Subheading", icon: Heading3, on: marks?.h3, run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
    { key: "list", label: "Bullet list", icon: List, on: marks?.list, run: () => editor?.chain().focus().toggleBulletList().run() },
    { key: "quote", label: "Quote", icon: Quote, on: marks?.quote, run: () => editor?.chain().focus().toggleBlockquote().run() },
  ];

  return (
    <>
      <div className={`write${panelOpen ? "" : " is-wide"}`}>
        <div className="write-main">
          <div className="write-bar" role="toolbar" aria-label="Formatting">
            {tools.map((tool) => (
              <button
                key={tool.key}
                type="button"
                className="icon-btn"
                aria-label={tool.label}
                aria-pressed={Boolean(tool.on)}
                title={tool.label}
                onClick={tool.run}
              >
                <tool.icon size={16} aria-hidden />
              </button>
            ))}
            <span className="write-bar-gap" />
            <button
              type="button"
              className="btn btn-quiet"
              aria-expanded={panelOpen}
              onClick={() => setPanelOpen(!panelOpen)}
            >
              {panelOpen ? <PanelRightClose size={15} aria-hidden /> : <PanelRightOpen size={15} aria-hidden />}
              {panelOpen ? "Hide tree" : "Show tree"}
            </button>
          </div>

          <div className="page" ref={page}>
            <input
              className="title-input"
              value={title}
              placeholder="Untitled"
              aria-label="Title"
              onChange={(event) => dispatch({ type: "setTitle", title: event.target.value })}
            />
            {nothingWritten && (
              <p className="page-hint">
                Each heading below is a plot point on this branch. Write under it, and open a heading to see
                what happens there.
              </p>
            )}
            <AnchorContext.Provider value={byId}>
              <EditorContent editor={editor} />
            </AnchorContext.Provider>
          </div>
        </div>

        {panelOpen && (
          <aside className="write-side panel" aria-label="The plot tree">
            <h2>This branch</h2>
            <p className="hint">
              The document tells the highlighted branch. Each plot point has one text, so a plot point shared
              by two branches reads the same on both. Click a plot point to jump to it or to switch to its
              branch; what you wrote elsewhere is kept.
            </p>

            <TreeGraph
              compact
              vertical
              nodes={nodes}
              beats={guideRail}
              links={links}
              showB={bPlot !== null}
              highlight={activeIds}
              status={status}
              onSelect={goToNode}
            />

            <p className="legend">
              <span className="node-dot" aria-hidden /> not written yet
              <span className="node-dot has-text" aria-hidden /> written
            </p>

          </aside>
        )}
      </div>

      <div className="step-nav">
        <button type="button" className="btn btn-quiet" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden /> Tree
        </button>
        <div className="step-nav-group">
          <button type="button" className="btn" onClick={copy}>
            <ClipboardCopy size={15} aria-hidden /> Copy for Google Docs
          </button>
          <button type="button" className="btn btn-primary" onClick={onReview}>
            Review <ArrowRight size={15} aria-hidden />
          </button>
        </div>
      </div>
    </>
  );
}
