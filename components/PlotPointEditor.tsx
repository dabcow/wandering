"use client";

import { Check, Link2, Trash2, X } from "lucide-react";
import { useState } from "react";
import { isLeaf } from "@/lib/tree";
import type { Link, PlotNode } from "@/lib/types";
import { AutoTextarea } from "./AutoTextarea";

type Props = {
  node: PlotNode;
  nodes: PlotNode[];
  links: Link[];
  hasB: boolean;
  onPatch: (patch: Partial<Pick<PlotNode, "title" | "summary" | "isEnding">>) => void;
  onPrune: () => void;
  onAddLink: (otherId: string) => void;
  onRemoveLink: (otherId: string) => void;
  onDone: () => void;
};

/** Edit the plot point in view, in place on its card: its text, ending, where it meets the other plot, or delete it. */
export function PlotPointEditor(props: Props) {
  const { node, nodes, links, hasB } = props;
  const [linkTarget, setLinkTarget] = useState("");

  const leaf = isLeaf(nodes, node.id);
  const otherPlot = node.plot === "main" ? "b" : "main";
  const otherName = otherPlot === "b" ? "subplot" : "main plot";
  const linkedIds = links
    .filter((l) => (node.plot === "main" ? l.mainId : l.bId) === node.id)
    .map((l) => (node.plot === "main" ? l.bId : l.mainId));
  const linked = nodes.filter((n) => linkedIds.includes(n.id));
  const linkable = nodes.filter((n) => n.plot === otherPlot && !linkedIds.includes(n.id));

  return (
    <div className="card-editor">
      <label className="field">
        <span className="label">Plot point</span>
        <input
          value={node.title}
          maxLength={160}
          autoFocus
          onChange={(event) => props.onPatch({ title: event.target.value })}
        />
      </label>
      <label className="field">
        <span className="label">What happens</span>
        <AutoTextarea
          value={node.summary}
          maxLength={700}
          placeholder="A sentence or two"
          onChange={(event) => props.onPatch({ summary: event.target.value })}
        />
      </label>

      <label className="check">
        <input
          type="checkbox"
          checked={node.isEnding}
          disabled={!leaf && !node.isEnding}
          onChange={(event) => props.onPatch({ isEnding: event.target.checked })}
        />
        This is an ending
      </label>
      {!leaf && !node.isEnding && (
        <p className="hint">Only the last plot point of a branch can be an ending.</p>
      )}

      {hasB && (
        <div className="inspector-links">
          <p className="label">
            <Link2 size={12} aria-hidden /> Where it meets the {otherName}
          </p>
          {linked.length === 0 && <p className="hint">The plots don&apos;t meet here yet.</p>}
          <ul>
            {linked.map((other) => (
              <li key={other.id}>
                <span>
                  Beat {other.level} · {other.title}
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Disconnect from ${other.title}`}
                  onClick={() => props.onRemoveLink(other.id)}
                >
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {linkable.length > 0 && (
            <div className="link-add">
              <select
                value={linkTarget}
                aria-label={`Plot point in the ${otherName} where they meet`}
                onChange={(event) => setLinkTarget(event.target.value)}
              >
                <option value="">Choose a plot point in the {otherName}…</option>
                {linkable.map((other) => (
                  <option key={other.id} value={other.id}>
                    Beat {other.level} · {other.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                disabled={!linkTarget}
                onClick={() => {
                  props.onAddLink(linkTarget);
                  setLinkTarget("");
                }}
              >
                Connect
              </button>
            </div>
          )}
        </div>
      )}

      <div className="inspector-actions">
        <button type="button" className="btn btn-primary" onClick={props.onDone}>
          <Check size={14} aria-hidden /> Done
        </button>
        <button type="button" className="btn btn-danger" onClick={props.onPrune}>
          <Trash2 size={14} aria-hidden /> {leaf ? "Delete" : "Delete with what follows"}
        </button>
      </div>
    </div>
  );
}
