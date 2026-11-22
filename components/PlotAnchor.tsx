"use client";

import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { ANCHOR_TYPE } from "@/lib/doc";
import type { PlotNode } from "@/lib/types";

/** The tree, as the anchors in the document need it. */
export const AnchorContext = createContext<Map<string, PlotNode>>(new Map());

function AnchorView({ node, selected }: NodeViewProps) {
  const byId = useContext(AnchorContext);
  const [open, setOpen] = useState(false);
  const ref = String(node.attrs.nodeId ?? "");
  const plotNode = byId.get(ref);
  // Leftover writing is filed under "branch/plot point". If the plot point is still in the
  // tree, the writing is from a branch through it that was deleted.
  const slash = ref.indexOf("/");
  const orphanOf = slash === -1 ? undefined : byId.get(ref.slice(slash + 1));
  const leftover = orphanOf
    ? `${orphanOf.title}, from a branch that was deleted`
    : slash !== -1 && slash === ref.length - 1
      ? "Opening text from a branch that was deleted"
      : "A plot point that was deleted from the tree";

  return (
    <NodeViewWrapper
      className={`anchor plot-${plotNode?.plot ?? "main"}${plotNode ? "" : " anchor-removed"}${selected ? " is-selected" : ""}`}
      contentEditable={false}
    >
      <button
        type="button"
        className="anchor-head"
        aria-expanded={plotNode ? open : undefined}
        disabled={!plotNode}
        onClick={() => setOpen(!open)}
      >
        {plotNode && (open ? <ChevronDown size={14} aria-hidden /> : <ChevronRight size={14} aria-hidden />)}
        <span className="anchor-pip" aria-hidden>
          {plotNode?.plot === "b" ? "♠" : "♥"}
        </span>
        {plotNode ? (
          <>
            <span className="anchor-level">Beat {plotNode.level}</span>
            <span className="anchor-title">{plotNode.title}</span>
            {plotNode.isEnding && <span className="tag tag-gold">ending</span>}
          </>
        ) : (
          <span className="anchor-title">{leftover}</span>
        )}
      </button>
      {open && plotNode && <p className="anchor-summary">{plotNode.summary || "No summary."}</p>}
    </NodeViewWrapper>
  );
}

function anchorIds(doc: PMNode): Set<string> {
  const ids = new Set<string>();
  doc.forEach((child) => {
    if (child.type.name === ANCHOR_TYPE) ids.add(String(child.attrs.nodeId ?? ""));
  });
  return ids;
}

type AnchorOptions = {
  /** Anchors whose plot point is still in the tree can't be deleted from the document. */
  keep: (nodeId: string) => boolean;
};

/**
 * A non-text marker tying a spot in the document to a plot node. The text
 * that follows it, up to the next anchor, is that node's section. To the
 * writer it is simply the plot point's heading.
 */
export const PlotAnchor = Node.create<AnchorOptions>({
  name: ANCHOR_TYPE,
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { keep: () => false };
  },

  addProseMirrorPlugins() {
    const { keep } = this.options;
    return [
      new Plugin({
        // A stray Backspace must not delete a plot point's heading (and with it, which plot
        // point the text below belongs to). Headings of plot points deleted from the tree may go.
        filterTransaction: (tr, state) => {
          if (!tr.docChanged) return true;
          const after = anchorIds(tr.doc);
          for (const id of anchorIds(state.doc)) {
            if (!after.has(id) && keep(id)) return false;
          }
          return true;
        },
        // Every heading keeps a line under it to write on, even after its text is deleted.
        appendTransaction: (transactions, _old, state) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const bare: number[] = [];
          state.doc.forEach((child, offset) => {
            if (child.type.name !== ANCHOR_TYPE) return;
            const next = state.doc.resolve(offset + child.nodeSize).nodeAfter;
            if (!next || next.type.name === ANCHOR_TYPE) bare.push(offset + child.nodeSize);
          });
          if (bare.length === 0) return null;
          const tr = state.tr;
          // From the end, so earlier positions stay valid.
          for (const pos of bare.reverse()) tr.insert(pos, state.schema.nodes.paragraph.create());
          return tr;
        },
      }),
    ];
  },

  addAttributes() {
    return {
      nodeId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-node-id"),
        renderHTML: (attributes) => ({ "data-node-id": attributes.nodeId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-plot-anchor]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-plot-anchor": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AnchorView);
  },
});
